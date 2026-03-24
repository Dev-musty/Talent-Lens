import { Injectable, Logger } from '@nestjs/common';
import { JobsModel } from '../jobs/model/jobs.model';
import { CreateApplicationDto } from '../applications/dtos/create-application.dto';
import { ScoringModel } from './model/scoring.model';

type GeminiModelClient = {
  generateContent: (
    prompt: string,
  ) => Promise<{ response: { text: () => string } }>;
};

type GeminiSdkClient = {
  getGenerativeModel: (input: {
    model: string;
    generationConfig: {
      temperature: number;
      responseMimeType: string;
    };
  }) => GeminiModelClient;
};

type GeminiSdkModule = {
  GoogleGenerativeAI: new (apiKey: string) => GeminiSdkClient;
};

class OpenRouterRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly responseBody: string,
    readonly retryAfterMs?: number,
  ) {
    super(`OpenRouter API error ${statusCode}: ${responseBody}`);
  }
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);
  private readonly geminiModel = 'gemini-2.0-flash';
  private readonly openRouterModel = process.env.OPENROUTER_MODEL?.trim();
  private readonly openRouterMaxRetries = 3;
  private readonly openRouterBaseDelayMs = 700;

  async scoreApplication(
    job: JobsModel,
    application: CreateApplicationDto,
  ): Promise<ScoringModel> {
    const prompt = this.buildPrompt(job, application);

    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
    let geminiFailureCode = 'gemini_missing_api_key';

    if (geminiApiKey) {
      try {
        const rawText = await this.requestGemini(prompt, geminiApiKey);
        const parsed = this.parseGeminiJson(rawText);

        if (parsed) {
          return parsed;
        }

        geminiFailureCode = 'gemini_invalid_model_output';
        this.logger.warn('Gemini returned invalid JSON payload');
      } catch (error) {
        geminiFailureCode = this.classifyGeminiError(error);
        this.logger.warn(`Gemini scoring failed (${geminiFailureCode})`);
      }
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (openRouterApiKey) {
      try {
        const rawText = await this.requestOpenRouter(prompt, openRouterApiKey);
        const parsed = this.parseGeminiJson(rawText);

        if (parsed) {
          return parsed;
        }

        this.logger.warn('OpenRouter returned invalid JSON payload');
        return this.fallback(application, 'openrouter_invalid_model_output');
      } catch (error) {
        const openRouterFailureCode = this.classifyOpenRouterError(error);
        this.logger.error(
          `OpenRouter scoring failed (${openRouterFailureCode})`,
          error as Error,
        );
        return this.fallback(application, openRouterFailureCode);
      }
    }

    if (!geminiApiKey) {
      this.logger.error(
        'GEMINI_API_KEY and OPENROUTER_API_KEY are missing. Returning scoring fallback',
      );
      return this.fallback(application, 'missing_ai_provider_keys');
    }

    this.logger.error(
      `Gemini failed and OPENROUTER_API_KEY is missing (${geminiFailureCode}). Returning scoring fallback`,
    );
    return this.fallback(application, geminiFailureCode);
  }

  private buildPrompt(
    job: JobsModel,
    application: CreateApplicationDto,
  ): string {
    return `You are an expert technical recruiter. Evaluate this freelancer for the role.

JOB TITLE: ${job.title}
JOB DESCRIPTION: ${job.description}
BUDGET RANGE: $${job.budget_min} - $${job.budget_max}

FREELANCER PROFILE:
Name: ${application.freelancer_name}
Skills: ${application.skills.join(', ')}
Years of Experience: ${application.years_experience}
Bio: ${application.bio ?? ''}
Portfolio URLs: ${(application.portfolio_urls ?? []).join(', ')}
Client Testimonies: ${application.testimonies ?? ''}
Proposed Rate: $${application.proposed_rate}

Return ONLY a valid JSON object. No markdown. No preamble.
{
  "inferred_tier": "junior" | "mid" | "senior",
  "fit_score": 0-100,
  "testimony_score": 0-100,
  "ai_reasoning": "2-3 sentence plain English explanation",
  "tier_reasoning": "one sentence explaining tier assignment"
}

Tier rules (use evidence only -- never self-declaration):
- junior: 0-2 years, limited/generic portfolio, no specialisation
- mid: 2-5 years, clear portfolio, some specialisation
- senior: 5+ years, deep specialisation, leadership signals`;
  }

  private async requestGemini(prompt: string, apiKey: string): Promise<string> {
    const sdk =
      (await import('@google/generative-ai')) as unknown as GeminiSdkModule;
    const client = new sdk.GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: this.geminiModel,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text?.trim()) {
      throw new Error('Gemini response did not include text content');
    }

    return text;
  }

  private async requestOpenRouter(
    prompt: string,
    apiKey: string,
  ): Promise<string> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.openRouterMaxRetries; attempt++) {
      try {
        return await this.requestOpenRouterOnce(prompt, apiKey);
      } catch (error) {
        lastError = error;

        if (!this.isRetryableOpenRouterError(error)) {
          throw error;
        }

        if (attempt >= this.openRouterMaxRetries) {
          throw error;
        }

        const retryDelay = this.computeRetryDelayMs(error, attempt);
        this.logger.warn(
          `OpenRouter request rate-limited/unavailable; retrying in ${retryDelay}ms (attempt ${attempt}/${this.openRouterMaxRetries})`,
        );
        await this.sleep(retryDelay);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('OpenRouter request failed');
  }

  private async requestOpenRouterOnce(
    prompt: string,
    apiKey: string,
  ): Promise<string> {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.openRouterModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = this.parseRetryAfterToMs(retryAfterHeader);

      throw new OpenRouterRequestError(response.status, body, retryAfterMs);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content;
    if (!text?.trim()) {
      throw new Error('OpenRouter response did not include text content');
    }

    return text;
  }

  private isRetryableOpenRouterError(error: unknown): boolean {
    if (error instanceof OpenRouterRequestError) {
      return [429, 500, 502, 503, 504].includes(error.statusCode);
    }

    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error);
    return (
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('timeout')
    );
  }

  private computeRetryDelayMs(error: unknown, attempt: number): number {
    if (
      error instanceof OpenRouterRequestError &&
      typeof error.retryAfterMs === 'number' &&
      Number.isFinite(error.retryAfterMs)
    ) {
      return Math.max(this.openRouterBaseDelayMs, error.retryAfterMs);
    }

    const backoff = this.openRouterBaseDelayMs * 2 ** (attempt - 1);
    const jitter = Math.floor(Math.random() * 250);
    return backoff + jitter;
  }

  private parseRetryAfterToMs(value: string | null): number | undefined {
    if (!value) {
      return undefined;
    }

    const asSeconds = Number(value);
    if (Number.isFinite(asSeconds) && asSeconds > 0) {
      return Math.round(asSeconds * 1000);
    }

    const asDateMs = Date.parse(value);
    if (!Number.isNaN(asDateMs)) {
      const delta = asDateMs - Date.now();
      return delta > 0 ? delta : undefined;
    }

    return undefined;
  }

  private async sleep(delayMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private parseGeminiJson(rawText: string): ScoringModel | null {
    try {
      const clean = rawText.replace(/```json|```/gi, '').trim();
      const jsonPayload = this.extractJsonObject(clean);
      const parsed = JSON.parse(jsonPayload) as Partial<ScoringModel> & {
        inferredTier?: unknown;
        fitScore?: unknown;
        testimonyScore?: unknown;
        aiReasoning?: unknown;
        tierReasoning?: unknown;
      };

      const inferredTier = this.normalizeTier(
        parsed.inferred_tier ?? parsed.inferredTier,
      );
      if (!inferredTier) {
        return null;
      }

      const fitScore = parsed.fit_score ?? parsed.fitScore;
      const testimonyScore = parsed.testimony_score ?? parsed.testimonyScore;
      const aiReasoning = parsed.ai_reasoning ?? parsed.aiReasoning;
      const tierReasoning = parsed.tier_reasoning ?? parsed.tierReasoning;
      const normalizedAiReasoning =
        typeof aiReasoning === 'string' && aiReasoning.trim()
          ? aiReasoning.trim()
          : 'Scoring completed by AI.';
      const normalizedTierReasoning =
        typeof tierReasoning === 'string' ? tierReasoning.trim() : '';

      return {
        inferred_tier: inferredTier,
        fit_score: this.toScore(fitScore),
        testimony_score: this.toScore(testimonyScore),
        ai_reasoning: normalizedAiReasoning,
        tier_reasoning: normalizedTierReasoning,
      };
    } catch {
      return null;
    }
  }

  private extractJsonObject(text: string): string {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');

    if (first !== -1 && last !== -1 && last > first) {
      return text.slice(first, last + 1);
    }

    return text;
  }

  private normalizeTier(value: unknown): 'junior' | 'mid' | 'senior' | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === 'junior') {
      return 'junior';
    }

    if (normalized === 'mid' || normalized === 'middle') {
      return 'mid';
    }

    if (normalized === 'senior') {
      return 'senior';
    }

    return null;
  }

  private toScore(value: unknown): number {
    const numeric =
      typeof value === 'string'
        ? Number(value.replace('%', '').trim())
        : Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  private fallback(
    application: CreateApplicationDto,
    failureCode: string,
  ): ScoringModel {
    const inferredTier = this.estimateTierFromExperience(
      application.years_experience,
    );

    return {
      inferred_tier: inferredTier,
      fit_score: 0,
      testimony_score: 0,
      ai_reasoning: `AI scoring temporarily unavailable (${failureCode}). Tier estimated from experience.`,
      tier_reasoning: `Estimated from ${application.years_experience} years of experience.`,
    };
  }

  private classifyGeminiError(error: unknown): string {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error);

    if (message.includes('api key') || message.includes('permission_denied')) {
      return 'gemini_invalid_api_key';
    }

    if (
      message.includes('quota') ||
      message.includes('rate limit') ||
      message.includes('resource_exhausted') ||
      message.includes('429')
    ) {
      return 'gemini_quota_exceeded';
    }

    if (message.includes('model') && message.includes('not found')) {
      return 'gemini_model_not_found';
    }

    if (message.includes('did not include text content')) {
      return 'gemini_empty_model_response';
    }

    return 'gemini_request_failed';
  }

  private classifyOpenRouterError(error: unknown): string {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error);

    if (
      message.includes('api error 401') ||
      message.includes('unauthorized') ||
      message.includes('invalid api key')
    ) {
      return 'openrouter_invalid_api_key';
    }

    if (
      message.includes('api error 429') ||
      message.includes('quota') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return 'openrouter_quota_exceeded';
    }

    if (message.includes('model') && message.includes('not found')) {
      return 'openrouter_model_not_found';
    }

    if (message.includes('did not include text content')) {
      return 'openrouter_empty_model_response';
    }

    return 'openrouter_request_failed';
  }

  private estimateTierFromExperience(
    yearsExperience: number,
  ): 'junior' | 'mid' | 'senior' {
    if (yearsExperience <= 2) {
      return 'junior';
    }

    if (yearsExperience <= 5) {
      return 'mid';
    }

    return 'senior';
  }
}

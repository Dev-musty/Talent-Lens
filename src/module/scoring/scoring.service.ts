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

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);
  private readonly model = 'gemini-2.0-flash';

  async scoreApplication(
    job: JobsModel,
    application: CreateApplicationDto,
  ): Promise<ScoringModel> {
    try {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        this.logger.error(
          'GEMINI_API_KEY is missing. Returning scoring fallback',
        );
        return this.fallback(application, 'missing_api_key');
      }

      const prompt = this.buildPrompt(job, application);
      const rawText = await this.requestGemini(prompt, apiKey);
      const parsed = this.parseGeminiJson(rawText);

      if (!parsed) {
        this.logger.error('Gemini returned invalid JSON payload');
        return this.fallback(application, 'invalid_model_output');
      }

      return parsed;
    } catch (error) {
      this.logger.error('Gemini scoring failed', error as Error);
      return this.fallback(application, this.classifyGeminiError(error));
    }
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
      model: this.model,
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
      return 'invalid_api_key';
    }

    if (
      message.includes('quota') ||
      message.includes('rate limit') ||
      message.includes('resource_exhausted') ||
      message.includes('429')
    ) {
      return 'quota_exceeded';
    }

    if (message.includes('model') && message.includes('not found')) {
      return 'model_not_found';
    }

    if (message.includes('did not include text content')) {
      return 'empty_model_response';
    }

    return 'gemini_request_failed';
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

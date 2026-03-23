import { Injectable, Logger } from '@nestjs/common';
import { JobsModel } from '../jobs/model/jobs.model';
import { CreateApplicationDto } from '../applications/dtos/create-application.dto';
import { ScoringModel } from './model/scoring.model';

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
        return this.fallback(application);
      }

      const prompt = this.buildPrompt(job, application);
      const rawText = await this.requestGemini(prompt, apiKey);
      const parsed = this.parseGeminiJson(rawText);

      if (!parsed) {
        this.logger.error('Gemini returned invalid JSON payload');
        return this.fallback(application);
      }

      return parsed;
    } catch (error) {
      this.logger.error('Gemini scoring failed', error as Error);
      return this.fallback(application);
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
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
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

  private fallback(application: CreateApplicationDto): ScoringModel {
    const inferredTier = this.estimateTierFromExperience(
      application.years_experience,
    );

    return {
      inferred_tier: inferredTier,
      fit_score: 0,
      testimony_score: 0,
      ai_reasoning:
        'AI scoring temporarily unavailable. Tier estimated from experience.',
      tier_reasoning: `Estimated from ${application.years_experience} years of experience.`,
    };
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

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
        return this.fallback();
      }

      const prompt = this.buildPrompt(job, application);
      const rawText = await this.requestGemini(prompt, apiKey);
      const parsed = this.parseGeminiJson(rawText);

      if (!parsed) {
        this.logger.error('Gemini returned invalid JSON payload');
        return this.fallback();
      }

      return parsed;
    } catch (error) {
      this.logger.error('Gemini scoring failed', error as Error);
      return this.fallback();
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
      const clean = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean) as Partial<ScoringModel>;

      const inferredTier = parsed.inferred_tier;
      if (
        inferredTier !== 'junior' &&
        inferredTier !== 'mid' &&
        inferredTier !== 'senior'
      ) {
        return null;
      }

      return {
        inferred_tier: inferredTier,
        fit_score: this.toScore(parsed.fit_score),
        testimony_score: this.toScore(parsed.testimony_score),
        ai_reasoning:
          typeof parsed.ai_reasoning === 'string' && parsed.ai_reasoning.trim()
            ? parsed.ai_reasoning.trim()
            : 'Scoring completed by AI.',
        tier_reasoning:
          typeof parsed.tier_reasoning === 'string'
            ? parsed.tier_reasoning.trim()
            : '',
      };
    } catch {
      return null;
    }
  }

  private toScore(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  private fallback(): ScoringModel {
    return {
      inferred_tier: 'unknown',
      fit_score: 0,
      testimony_score: 0,
      ai_reasoning: 'Scoring pending -- please check back shortly.',
      tier_reasoning: '',
    };
  }
}

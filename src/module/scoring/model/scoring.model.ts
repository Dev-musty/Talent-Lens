import type { RequiredTier } from '../../jobs/model/jobs.model';

export type InferredTier = Exclude<RequiredTier, 'any'> | 'unknown';

export interface ScoringModel {
  inferred_tier: InferredTier;
  fit_score: number;
  testimony_score: number;
  ai_reasoning: string;
  tier_reasoning: string;
}

export interface ScoringBreakdownModel extends ScoringModel {
  price_score: number;
  overall_rank_score: number;
}

export interface ScoringFallbackModel extends ScoringModel {
  inferred_tier: 'unknown';
  fit_score: 0;
  testimony_score: 0;
}

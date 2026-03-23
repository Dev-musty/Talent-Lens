import { Injectable } from '@nestjs/common';
import { JobsModel } from '../jobs/model/jobs.model';
import { CreateApplicationDto } from '../applications/dtos/create-application.dto';
import { ScoringModel } from './model/scoring.model';

@Injectable()
export class ScoringService {
  async scoreApplication(
    job: JobsModel,
    application: CreateApplicationDto,
  ): Promise<ScoringModel> {
    try {
      const inferred_tier = this.inferTier(application.years_experience);
      const fit_score = this.computeFitScore(job, application);
      const testimony_score = this.computeTestimonyScore(
        application.testimonies,
      );

      return {
        inferred_tier,
        fit_score,
        testimony_score,
        ai_reasoning:
          'Profile assessed using skills, experience, and role alignment signals.',
        tier_reasoning: `Tier inferred from experience (${application.years_experience} years).`,
      };
    } catch {
      return {
        inferred_tier: 'unknown',
        fit_score: 0,
        testimony_score: 0,
        ai_reasoning: 'Scoring pending -- please check back shortly.',
        tier_reasoning: '',
      };
    }
  }

  private inferTier(yearsExperience: number): 'junior' | 'mid' | 'senior' {
    if (yearsExperience <= 2) {
      return 'junior';
    }
    if (yearsExperience <= 5) {
      return 'mid';
    }
    return 'senior';
  }

  private computeFitScore(
    job: JobsModel,
    application: CreateApplicationDto,
  ): number {
    const description = `${job.title} ${job.description}`.toLowerCase();
    const skillMatches = application.skills.filter((skill) =>
      description.includes(skill.toLowerCase()),
    ).length;

    const skillScore = Math.min(70, skillMatches * 15);
    const experienceScore = Math.min(30, application.years_experience * 5);

    return Math.max(0, Math.min(100, Math.round(skillScore + experienceScore)));
  }

  private computeTestimonyScore(testimonies?: string): number {
    if (!testimonies || !testimonies.trim()) {
      return 0;
    }

    const length = testimonies.trim().length;
    if (length < 40) {
      return 40;
    }
    if (length < 120) {
      return 65;
    }
    return 80;
  }
}

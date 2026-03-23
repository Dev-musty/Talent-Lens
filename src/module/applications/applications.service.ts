import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CreateApplicationDto } from './dtos/create-application.dto';
import { ListApplicationsDto } from './dtos/list-applications.dto';
import { ApplicationModel } from './model/application.model';
import { JobsModel, RequiredTier } from '../jobs/model/jobs.model';
import { ScoringService } from '../scoring/scoring.service';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(ApplicationModel)
    private readonly applicationsRepository: Repository<ApplicationModel>,
    @InjectRepository(JobsModel)
    private readonly jobsRepository: Repository<JobsModel>,
    private readonly scoringService: ScoringService,
  ) {}

  async apply(link: string, createApplicationDto: CreateApplicationDto) {
    const job = await this.jobsRepository.findOne({
      where: { unique_link: link },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const scoring = await this.scoringService.scoreApplication(
      job,
      createApplicationDto,
    );

    const price_score = this.computePriceScore(
      createApplicationDto.proposed_rate,
      job.budget_min,
      job.budget_max,
    );

    const overall_rank_score = Math.round(
      scoring.fit_score * 0.5 +
        scoring.testimony_score * 0.3 +
        price_score * 0.2,
    );

    const access_granted = this.checkTierAccess(
      scoring.inferred_tier,
      job.required_tier,
    );

    const rejection_reason = access_granted
      ? null
      : `This role requires ${job.required_tier}. Your profile was assessed as ${scoring.inferred_tier}.`;

    const application = this.applicationsRepository.create({
      job_id: job.id,
      ...createApplicationDto,
      inferred_tier: scoring.inferred_tier,
      fit_score: scoring.fit_score,
      testimony_score: scoring.testimony_score,
      price_score,
      overall_rank_score,
      ai_reasoning: scoring.ai_reasoning,
      tier_reasoning: scoring.tier_reasoning,
      access_granted,
      rejection_reason: rejection_reason ?? undefined,
    });

    await this.applicationsRepository.save(application);

    if (!access_granted) {
      return {
        access_granted: false,
        inferred_tier: scoring.inferred_tier,
        rejection_reason,
      };
    }

    const ranked = await this.applicationsRepository.find({
      where: {
        job_id: job.id,
        access_granted: true,
      },
      order: {
        overall_rank_score: 'DESC',
        created_at: 'ASC',
      },
    });

    const rank_position =
      ranked.findIndex((item) => item.id === application.id) + 1;

    const total_applicants = await this.applicationsRepository.count({
      where: { job_id: job.id },
    });

    return {
      access_granted: true,
      inferred_tier: scoring.inferred_tier,
      fit_score: scoring.fit_score,
      overall_rank_score,
      rank_position,
      total_applicants,
      ai_reasoning: scoring.ai_reasoning,
    };
  }

  async listApplications(link: string, query: ListApplicationsDto) {
    const job = await this.jobsRepository.findOne({
      where: { unique_link: link },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const whereClause: FindOptionsWhere<ApplicationModel> = {
      job_id: job.id,
      access_granted: true,
    };

    if (query.tier) {
      whereClause.inferred_tier = query.tier;
    }

    const order =
      query.sort === 'price'
        ? { price_score: 'DESC' as const, created_at: 'ASC' as const }
        : query.sort === 'testimony'
          ? { testimony_score: 'DESC' as const, created_at: 'ASC' as const }
          : { overall_rank_score: 'DESC' as const, created_at: 'ASC' as const };

    return this.applicationsRepository.find({
      where: whereClause,
      order,
    });
  }

  private computePriceScore(
    proposed: number,
    min: number,
    max: number,
  ): number {
    if (proposed >= min && proposed <= max) {
      return 100;
    }

    if (proposed < min) {
      const diff = (min - proposed) / min;
      return Math.max(0, Math.round(100 - diff * 30));
    }

    const overage = (proposed - max) / max;
    return Math.max(0, Math.round(100 - overage * 100));
  }

  private checkTierAccess(
    inferred: ApplicationModel['inferred_tier'],
    required: RequiredTier,
  ): boolean {
    if (required === 'any') {
      return true;
    }

    if (!inferred || inferred === 'unknown') {
      return false;
    }

    if (required === 'junior') {
      return inferred === 'junior';
    }

    if (required === 'mid') {
      return inferred === 'mid' || inferred === 'senior';
    }

    return inferred === 'senior';
  }
}

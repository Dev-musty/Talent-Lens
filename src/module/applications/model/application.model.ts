import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base-model';
import { JobsModel, type RequiredTier } from '../../jobs/model/jobs.model';

export type InferredTier = RequiredTier | 'unknown';

@Entity({ name: 'applications' })
@Index('idx_applications_job_id', ['job_id'])
@Index('idx_applications_rank', ['job_id', 'overall_rank_score'])
export class ApplicationModel extends BaseEntity {
  @Column({ type: 'uuid', name: 'job_id' })
  job_id: string;

  @ManyToOne(() => JobsModel, (job) => job.applications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'job_id' })
  job: JobsModel;

  @Column({ type: 'text', name: 'freelancer_name' })
  freelancer_name: string;

  @Column({ type: 'text', array: true })
  skills: string[];

  @Column({ type: 'int', name: 'years_experience' })
  years_experience: number;

  @Column({ type: 'text', array: true, name: 'portfolio_urls', nullable: true })
  portfolio_urls?: string[];

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'text', nullable: true })
  testimonies?: string;

  @Column({ type: 'int', name: 'proposed_rate' })
  proposed_rate: number;

  @Column({ type: 'text', name: 'inferred_tier', nullable: true })
  inferred_tier?: InferredTier;

  @Column({ type: 'int', name: 'fit_score', nullable: true })
  fit_score?: number;

  @Column({ type: 'int', name: 'testimony_score', nullable: true })
  testimony_score?: number;

  @Column({ type: 'int', name: 'price_score', nullable: true })
  price_score?: number;

  @Column({ type: 'int', name: 'overall_rank_score', nullable: true })
  overall_rank_score?: number;

  @Column({ type: 'text', name: 'ai_reasoning', nullable: true })
  ai_reasoning?: string;

  @Column({ type: 'text', name: 'tier_reasoning', nullable: true })
  tier_reasoning?: string;

  @Column({ type: 'boolean', name: 'access_granted', default: false })
  access_granted: boolean;

  @Column({ type: 'text', name: 'rejection_reason', nullable: true })
  rejection_reason?: string;
}

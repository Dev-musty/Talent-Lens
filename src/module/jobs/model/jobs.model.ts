import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/base-model';
import { ApplicationModel } from '../../applications/model/application.model';

export type RequiredTier = 'any' | 'junior' | 'mid' | 'senior';

@Entity({ name: 'jobs' })
export class JobsModel extends BaseEntity {
  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int', name: 'budget_min' })
  budget_min: number;

  @Column({ type: 'int', name: 'budget_max' })
  budget_max: number;

  @Column({
    type: 'text',
    name: 'required_tier',
    default: 'any',
  })
  required_tier: RequiredTier;

  @Column({ type: 'text', name: 'client_name' })
  client_name: string;

  @Index({ unique: true })
  @Column({ type: 'text', name: 'unique_link' })
  unique_link: string;

  @OneToMany(() => ApplicationModel, (application) => application.job)
  applications: ApplicationModel[];
}

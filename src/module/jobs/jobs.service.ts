import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { nanoid } from 'nanoid';
import { Repository } from 'typeorm';
import { CreateJobDto } from './dtos/create-job.dto';
import { JobsModel } from './model/jobs.model';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(JobsModel)
    private readonly jobsRepository: Repository<JobsModel>,
  ) {}

  private async generateUniqueLink(): Promise<string> {
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const link = nanoid(8);
      const existing = await this.jobsRepository.findOne({
        where: { unique_link: link },
      });

      if (!existing) {
        return link;
      }
    }

    throw new ConflictException('Unable to generate a unique job link');
  }

  async createJob(createJobDto: CreateJobDto) {
    if (createJobDto.budget_min > createJobDto.budget_max) {
      throw new BadRequestException(
        'budget_min cannot be greater than budget_max',
      );
    }

    const uniqueLink = await this.generateUniqueLink();

    const job = this.jobsRepository.create({
      ...createJobDto,
      unique_link: uniqueLink,
    });

    const savedJob = await this.jobsRepository.save(job);

    return {
      id: savedJob.id,
      unique_link: savedJob.unique_link,
      apply_url: `/apply/${savedJob.unique_link}`,
      dashboard_url: `/dashboard/${savedJob.unique_link}`,
    };
  }

  async getJobByLink(link: string) {
    const job = await this.jobsRepository.findOne({
      where: { unique_link: link },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }
}

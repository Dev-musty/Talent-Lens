import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateJobDto } from './dtos/create-job.dto';
import {
  ApiCreateJobDocs,
  ApiGetJobByLinkDocs,
  ApiJobsControllerDocs,
} from './docs/jobs.docs';
import { JobsService } from './jobs.service';

@ApiJobsControllerDocs()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiCreateJobDocs()
  createJob(@Body() createJobDto: CreateJobDto) {
    return this.jobsService.createJob(createJobDto);
  }

  @Get(':link')
  @ApiGetJobByLinkDocs()
  getJobByLink(@Param('link') link: string) {
    return this.jobsService.getJobByLink(link);
  }
}

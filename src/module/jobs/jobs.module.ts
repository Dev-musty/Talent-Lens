import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobsModel } from './model/jobs.model';

@Module({
  imports: [TypeOrmModule.forFeature([JobsModel])],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}

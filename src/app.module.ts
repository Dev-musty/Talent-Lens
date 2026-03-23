import { Module } from '@nestjs/common';
import { dataSource } from './database/data-source';
import { CommonModule } from './commmon/common.module';
import { JobsModule } from './module/jobs/jobs.module';
import { ApplicationsModule } from './module/applications/applications.module';
import { ScoringModule } from './module/scoring/scoring.module';
import { TypeOrmModule } from '@nestjs/typeorm';
@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...dataSource.options,
      }),
      dataSourceFactory: async () => {
        if (!dataSource.isInitialized) {
          await dataSource.initialize();
        }
        return dataSource;
      },
    }),
    JobsModule,
    ApplicationsModule,
    ScoringModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

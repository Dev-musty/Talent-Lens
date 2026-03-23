import { Module } from '@nestjs/common';
import { CommonModule } from './commmon/common.module';
import { JobsModule } from './module/jobs/jobs.module';
import { ApplicationsModule } from './module/applications/applications.module';
import { ScoringModule } from './module/scoring/scoring.module';
import { TypeOrmModule } from '@nestjs/typeorm';

const buildTypeOrmOptions = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const sslEnabled = process.env.DB_SSL === 'true';

  if (databaseUrl) {
    const parsedUrl = new URL(databaseUrl);
    return {
      type: 'postgres' as const,
      host: parsedUrl.hostname,
      port: Number(parsedUrl.port || 5432),
      username: decodeURIComponent(parsedUrl.username || ''),
      password: String(decodeURIComponent(parsedUrl.password || '')),
      database: decodeURIComponent(parsedUrl.pathname.replace(/^\//, '')),
      ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
      autoLoadEntities: true,
      synchronize: false,
    };
  }

  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME,
    password: String(process.env.DB_PASSWORD || ''),
    database: process.env.DB,
    ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
    autoLoadEntities: true,
    synchronize: false,
  };
};

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forRootAsync({
      useFactory: () => buildTypeOrmOptions(),
    }),
    JobsModule,
    ApplicationsModule,
    ScoringModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

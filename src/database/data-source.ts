import { Logger } from '@nestjs/common';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// Configure env path
dotenv.config({ path: join(__dirname, '../../.env') });

// File extentions
const tsExt = __filename.endsWith('ts');
const fileExt = tsExt ? 'ts' : 'js';

const entitiesPath = [
  join(__dirname, '../module/**/model/*.' + fileExt),
  join(__dirname, '../modules/**/models/*.' + fileExt),
];

const migrationPath = [
  join(__dirname, '../database/migration/*.' + fileExt),
  join(__dirname, '../database/migrations/*.' + fileExt),
];

const dbType =
  (process.env.DB_TYPE as DataSourceOptions['type'] | undefined) || 'postgres';

const sslEnabled = process.env.DB_SSL === 'true';

const dataSourceConfig = {
  type: dbType,
  ...(process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
      }
    : {
        host: process.env.DB_HOST,
        password: String(process.env.DB_PASSWORD || ''),
        database: process.env.DB,
        port: Number(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME,
      }),
  ...(sslEnabled
    ? {
        ssl: { rejectUnauthorized: false },
      }
    : {}),
  entities: entitiesPath,
  migrations: migrationPath,
  synchronize: false,
} as DataSourceOptions;
export const dataSource = new DataSource(dataSourceConfig);

export const intializeDataSource = async () => {
  const logger = new Logger('database');
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
    try {
      const migrations = await dataSource.runMigrations();
      if (migrations.length > 0) {
        logger.log(`${migrations.length} migration(s) ran`);
      } else {
        logger.log('No pending migrations');
      }
    } catch (error) {
      logger.error('Error running migrations', error);
      throw error;
    }
  }
  return dataSource;
};

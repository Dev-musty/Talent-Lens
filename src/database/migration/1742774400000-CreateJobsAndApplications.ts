import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobsAndApplications1742774400000 implements MigrationInterface {
  name = 'CreateJobsAndApplications1742774400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "title" text NOT NULL,
        "description" text NOT NULL,
        "budget_min" integer NOT NULL,
        "budget_max" integer NOT NULL,
        "required_tier" text NOT NULL DEFAULT 'any',
        "client_name" text NOT NULL,
        "unique_link" text NOT NULL,
        CONSTRAINT "PK_jobs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_jobs_unique_link" UNIQUE ("unique_link")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "applications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "job_id" uuid NOT NULL,
        "freelancer_name" text NOT NULL,
        "skills" text array NOT NULL,
        "years_experience" integer NOT NULL,
        "portfolio_urls" text array,
        "bio" text,
        "testimonies" text,
        "proposed_rate" integer NOT NULL,
        "inferred_tier" text,
        "fit_score" integer,
        "testimony_score" integer,
        "price_score" integer,
        "overall_rank_score" integer,
        "ai_reasoning" text,
        "tier_reasoning" text,
        "access_granted" boolean NOT NULL DEFAULT false,
        "rejection_reason" text,
        CONSTRAINT "PK_applications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_applications_job_id"
      ON "applications" ("job_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_applications_rank"
      ON "applications" ("job_id", "overall_rank_score" DESC)
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_applications_job_id_jobs_id'
        ) THEN
          ALTER TABLE "applications"
          ADD CONSTRAINT "FK_applications_job_id_jobs_id"
          FOREIGN KEY ("job_id") REFERENCES "jobs"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "applications"
      DROP CONSTRAINT IF EXISTS "FK_applications_job_id_jobs_id"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_applications_rank"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_applications_job_id"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "applications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs"`);
  }
}

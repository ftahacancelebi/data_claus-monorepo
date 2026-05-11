import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marketplace pivot — `data_packages` + `package_purchases`.
 *
 * In dev `synchronize: true` already builds the tables from the entities;
 * this migration exists for prod deploys (DATABASE_SYNCHRONIZE=false).
 *
 * The status enum is created with a name matching what TypeORM auto-generates
 * (`data_packages_status_enum`) so the entity column stays compatible after
 * the migration runs.
 */
export class AddDataPackages1715300000000 implements MigrationInterface {
  name = 'AddDataPackages1715300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "data_packages_status_enum" AS ENUM (
          'pending', 'evaluating', 'certified', 'rejected', 'sold', 'delisted'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "data_packages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "developer_id" uuid NOT NULL,
        "application_id" uuid NULL,
        "title" varchar(200) NOT NULL,
        "description" text NULL,
        "category" varchar(50) NOT NULL,
        "claimed_metrics" jsonb NOT NULL,
        "schema_json" jsonb NOT NULL,
        "sample_rows" jsonb NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "status" "data_packages_status_enum" NOT NULL DEFAULT 'pending',
        "dataclaus_score" numeric(4,3) NULL,
        "llm_evaluation" jsonb NULL,
        "evaluated_at" TIMESTAMP NULL,
        CONSTRAINT "PK_data_packages" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_packages_status_score"
        ON "data_packages" ("status", "dataclaus_score");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_packages_developer"
        ON "data_packages" ("developer_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_packages_category"
        ON "data_packages" ("category");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "package_purchases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "package_id" uuid NOT NULL,
        "buyer_id" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "ledger_transaction_id" uuid NULL,
        "download_token" varchar(64) NULL,
        "purchased_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_package_purchases" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_purchases_buyer"
        ON "package_purchases" ("buyer_id", "purchased_at");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_purchases_package"
        ON "package_purchases" ("package_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_purchases_package"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_purchases_buyer"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "package_purchases"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_packages_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_packages_developer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_packages_status_score"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "data_packages"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "data_packages_status_enum"`);
  }
}

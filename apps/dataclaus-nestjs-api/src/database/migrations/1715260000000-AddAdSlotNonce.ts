import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Slot/seal hardening migration.
 *
 * Adds the columns and indexes required for the bypass-resistant
 * slot/seal flow introduced in commit 6b1e42d.
 *
 * Schema additions on `ad_impressions`:
 *   - `slot_nonce`         TEXT, nullable  (server-issued nonce, replay key)
 *   - `sealed_at`          TIMESTAMP, nullable
 *   - `revenue_confirmed`  BOOLEAN, default false
 *
 * Index additions:
 *   - `uq_ad_impressions_nonce` UNIQUE partial index on `slot_nonce`
 *     (only enforced where `slot_nonce IS NOT NULL` so legacy rows from
 *     the deprecated `/impression` endpoint don't collide).
 *
 * In dev, `synchronize: true` already creates these — this migration
 * exists for production deployments and any environment where
 * `DATABASE_SYNCHRONIZE=false`.
 */
export class AddAdSlotNonce1715260000000 implements MigrationInterface {
  name = 'AddAdSlotNonce1715260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ad_impressions"
      ADD COLUMN IF NOT EXISTS "slot_nonce" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "ad_impressions"
      ADD COLUMN IF NOT EXISTS "sealed_at" TIMESTAMP NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "ad_impressions"
      ADD COLUMN IF NOT EXISTS "revenue_confirmed" BOOLEAN NOT NULL DEFAULT false
    `);

    // Partial unique index — duplicate slot_nonce on non-null rows is a
    // replay attempt and must fail loudly.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ad_impressions_nonce"
        ON "ad_impressions" ("slot_nonce")
        WHERE "slot_nonce" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_ad_impressions_nonce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ad_impressions" DROP COLUMN IF EXISTS "revenue_confirmed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ad_impressions" DROP COLUMN IF EXISTS "sealed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ad_impressions" DROP COLUMN IF EXISTS "slot_nonce"`,
    );
  }
}

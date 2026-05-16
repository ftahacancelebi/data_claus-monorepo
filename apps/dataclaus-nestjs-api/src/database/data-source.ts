import 'reflect-metadata';
import { DataSource } from 'typeorm';

// dotenv is a dev-only dependency for the migration CLI. Loaded lazily so
// production runtime (which sources env from the platform) never imports it.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  // dotenv not installed — fine, env comes from the platform
}

/**
 * Standalone TypeORM DataSource for migration tooling.
 *
 * Usage:
 *   pnpm typeorm migration:generate src/database/migrations/MyChange -d src/database/data-source.ts
 *   pnpm typeorm migration:run -d src/database/data-source.ts
 *   pnpm typeorm migration:revert -d src/database/data-source.ts
 *
 * Runtime entity loading happens in `app.module.ts` — this file only
 * exists for the CLI.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'dataclaus',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: false,
});

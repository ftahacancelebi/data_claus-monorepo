# DataClaus — Scripts

Operational helpers for the capstone demo. All scripts read DB credentials
from `apps/dataclaus-nestjs-api/.env` (with sane localhost defaults).

## Demo lifecycle

| Script | Command | What it does |
|--------|---------|--------------|
| `demo-seed.ts`   | `pnpm run demo:seed`   | Populates predictable demo data (3 devs, 5 users, 2 buyers, 3 campaigns, 100 impressions, 50 scored events, 2 payouts). Idempotent. Writes `JURY_LOGIN.md`. |
| `demo-replay.ts` | `pnpm run demo:replay` | Generates one ad impression every 5s against demo applications/users so dashboards animate during the live presentation. |
| `demo-reset.ts`  | `pnpm run demo:reset`  | Truncates demo tables (cascade-safe order) and re-runs `demo-seed.ts`. Refuses to run when `NODE_ENV=production`. |

## Other

| Script | What it does |
|--------|--------------|
| `e2e-test.sh` | Existing end-to-end shell runner. |

## Prerequisites

- Postgres running (`docker-compose up -d`).
- API migrations / sync applied — the easiest way is to start the NestJS
  API once (`pnpm --filter dataclaus-nestjs-api start:dev`) so TypeORM
  `synchronize` creates the schema, then stop it and run the seed.

## Demo password

All demo accounts share the password `demo1234`. Credentials are written
to `JURY_LOGIN.md` at the repo root after each seed run.

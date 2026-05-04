# Database schema is out of sync

**Symptom:** API boot fails with `column "xxx" does not exist`, or the seed
script crashes with `relation "..." does not exist`.

## Why it happens

In dev we rely on TypeORM `synchronize: true` (configured in
`apps/dataclaus-nestjs-api/src/config/database.config.ts`). If the entity
definitions changed but the API hasn't been booted since, the schema is
older than the code. Production-style migrations are not yet wired up — see
`memory-bank/implementation/00-master-plan.md` Phase 8.

## Fix order (least to most destructive)

```bash
# 1. Boot the API once — synchronize will catch up additive changes
cd apps/dataclaus-nestjs-api
pnpm run start:dev
# Watch for "Application is running on http://localhost:3000"
# then Ctrl+C
```

If a column was renamed/dropped, `synchronize` cannot reconcile and you'll
need to drop the table:

```bash
# 2. Drop the conflicting table only
docker exec -it $(docker ps --filter name=dataclaus-postgres -q) \
  psql -U postgres -d dataclaus -c 'DROP TABLE IF EXISTS "<table>" CASCADE;'

# Boot the API again to recreate it
```

For a clean slate (loses all data, INCLUDING demo data):

```bash
# 3. Nuke the database and recreate
docker compose down -v        # WARNING: removes Postgres volume
docker compose up -d
cd apps/dataclaus-nestjs-api && pnpm run start:dev   # let synchronize rebuild
# Then re-seed:
cd ../.. && pnpm run demo:seed
```

## Verify

```bash
docker exec -it $(docker ps --filter name=dataclaus-postgres -q) \
  psql -U postgres -d dataclaus -c '\dt'
# Should list: developers, applications, dataclaus_users, wallets,
# ledger_transactions, ad_impressions, scored_events, payout_requests, …
```

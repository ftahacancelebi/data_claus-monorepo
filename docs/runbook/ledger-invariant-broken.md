# Ledger invariant is broken

**Symptom:** `/admin/health/full` returns `Ledger invariant: BROKEN` with a
non-zero `net` value, or the cron `ledger.invariant.broken` event has been
emitted.

> **This is a P0 condition.** Stop accepting writes if it shows up in
> production. Demo-mode response is still serious — usually the result of a
> non-atomic edit during development.

## Step 1 — Capture the snapshot

```bash
docker exec -it $(docker ps --filter name=dataclaus-postgres -q) \
  psql -U postgres -d dataclaus <<'SQL'
SELECT
  COALESCE(SUM(amount), 0)::text AS net,
  COUNT(*)::text                 AS rows,
  COUNT(*) FILTER (WHERE paired_transaction_id IS NULL)::text AS orphans
FROM ledger_transactions
WHERE status = 'completed';
SQL
```

The expected output is `net = 0, orphans = 0`. If `orphans > 0` you have
single-leg entries. If `net != 0` and `orphans = 0`, both legs exist but
the amounts disagree.

## Step 2 — Bisect

```sql
-- Find the offending pair(s) — single-leg rows by reference
SELECT reference_id, COUNT(*) AS legs, SUM(amount) AS net_amount
  FROM ledger_transactions
 WHERE status = 'completed'
 GROUP BY reference_id
HAVING SUM(amount) <> 0 OR COUNT(*) < 2
 ORDER BY ABS(SUM(amount)) DESC
 LIMIT 25;
```

Pick the row with the largest absolute imbalance and trace it through the
audit log:

```sql
SELECT * FROM audit_logs
 WHERE metadata @> jsonb_build_object('referenceId', '<id>'::text)
 ORDER BY created_at;
```

## Step 3 — Decide

| Situation | Action |
|-----------|--------|
| Demo / dev only | `pnpm run demo:reset` to wipe and reseed |
| Single offending pair, you can identify the missing leg | Insert the missing leg as a `manual_repair` typed transaction inside a single transaction; record the operator id |
| Mass corruption | Take the platform offline, restore from the most recent backup |

## Step 4 — Prevent recurrence

- Verify all financial mutations go through `FinancialTxService` which wraps
  inserts in a TypeORM `QueryRunner.transaction`.
- Add a regression test reproducing the failure path before closing the
  incident.
- Re-run `pnpm test` in `apps/dataclaus-nestjs-api` and ensure
  `ledger-invariant.service.spec.ts` and `financial-tx.service.spec.ts`
  both pass.

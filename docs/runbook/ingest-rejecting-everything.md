# Ingest pipeline is rejecting every event

**Symptom:** `tiktok-backend` logs `HTTP 401 Invalid HMAC signature` (or 400
`fraudScore_threshold`, `replay_detected`) for every batch, and `scored_events`
table count stays flat in the dashboard.

## Quick triage

```bash
# 1. Confirm the API is up and reachable
curl -s http://localhost:3000/admin/health/full | jq '.checks[] | select(.name=="Ingest pipeline")'

# 2. Inspect last 20 ingest log lines
docker logs $(docker ps --filter name=dataclaus-api -q) --tail 200 | grep -i ingest
```

## Common causes & fixes

| Cause | Diagnostic | Fix |
|-------|-----------|-----|
| Demo backend uses a stale HMAC secret | `tiktok-backend/.env` HMAC secret differs from the API's `apiKeys.secret` | Re-run `pnpm run demo:seed` to regenerate predictable keys, then copy the new secret into the demo backend env |
| Clock skew on the laptop | `date` differs between the API host and demo backend | Sync the clock (`sudo sntp -sS time.apple.com` on macOS) — HMAC includes a timestamp window |
| `fraudScore` missing from SDK payload | Inspect a single payload via the demo backend log | Update `sdk-react-native` to ensure the fraud-detection module emits `fraudScore`; the API rejects payloads where it is absent |
| Replay guard tripping | Same `eventId` appears twice within the dedupe window | Ensure each batch generates fresh UUIDs; in dev, restart the demo backend to flush its in-memory queue |

## Last resort

```bash
# Wipe scored events to confirm fresh inserts succeed
docker exec -it $(docker ps --filter name=dataclaus-postgres -q) \
  psql -U postgres -d dataclaus -c "TRUNCATE scored_events RESTART IDENTITY CASCADE;"

# Push a single event manually with a known-good signature using the SDK helper
# (see packages/sdk-node/examples/ingest-test.ts)
```

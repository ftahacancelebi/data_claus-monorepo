# Webhook deliveries are failing

**Symptom:** `/admin/health/full` shows the `Webhook outbox` check as
yellow/red with a non-zero `failed (last hour)` value, or developer
endpoints never receive notifications.

## Inspect the outbox

```bash
docker exec -it $(docker ps --filter name=dataclaus-postgres -q) \
  psql -U postgres -d dataclaus -c "
    SELECT id, event_type, status, attempts, last_response_status, last_error
      FROM webhook_deliveries
     WHERE status IN ('pending', 'failed')
     ORDER BY created_at DESC
     LIMIT 25;"
```

## Common causes & fixes

| Cause | Diagnostic | Fix |
|-------|-----------|-----|
| Endpoint URL unreachable | `last_response_status` is null, `last_error` mentions DNS/timeout | Update `webhook_endpoints.url` to a reachable address (use https://webhook.site for demo) |
| HMAC secret rotated, consumer didn't update | Receiver returns 401/403 with "invalid signature" | Issue a fresh secret via the developer dashboard, give it to the consumer, delete the old one |
| Consumer is rate-limiting | `last_response_status = 429` | Slow down the dispatcher's concurrency, or coordinate with the consumer to whitelist us |
| Background dispatcher not running | `attempts = 0` for hours | Confirm the dispatcher cron is active; restart the API |

## Manual retry (single delivery)

```sql
UPDATE webhook_deliveries
   SET status = 'pending', next_attempt_at = NOW()
 WHERE id = '<delivery-id>';
```

## Drain / reset (demo only)

```sql
DELETE FROM webhook_deliveries WHERE status IN ('pending','failed');
```

> Production: never delete deliveries; mark them as `cancelled` instead so
> the audit trail survives.

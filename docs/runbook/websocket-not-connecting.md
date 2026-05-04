# Dashboard WebSocket is not connecting

**Symptom:** `/dashboard` charts never animate during `pnpm run demo:replay`,
browser console shows `WebSocket connection to 'ws://localhost:3000/realtime'
failed`, or `/admin/health/full` reports the WebSocket check as red.

## Triage checklist

```bash
# 1. Is the namespace reachable at all?
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://localhost:3000/realtime
# Expect 101 Switching Protocols (or 400 from socket.io handshake — that's fine)

# 2. Health endpoint
curl -s http://localhost:3000/admin/health/full \
  | jq '.checks[] | select(.name == "WebSocket")'
```

## Common causes & fixes

| Cause | Fix |
|-------|-----|
| API not running | `cd apps/dataclaus-nestjs-api && pnpm run start:dev` |
| CORS blocking the upgrade | The gateway uses `cors: { origin: '*' }`. If you tightened it, allowlist the dashboard origin |
| JWT token missing | The realtime gateway requires a Bearer token; ensure `localStorage.getItem('dataclaus_token')` is set (login via `/jury` if you cleared storage) |
| Reverse proxy stripping `Upgrade` headers | If you put nginx/caddy in front, ensure WS upgrade headers are forwarded |
| Dashboard hard-coded port | Verify the dashboard is calling `ws://localhost:3000/realtime`, not `:3001` |

## Last resort

Restart the entire dev stack:

```bash
docker compose restart
pnpm run dev:all
```

If the `/admin/health/full` WebSocket check stays red even after a restart,
add a temporary log inside `realtime.gateway.ts:handleConnection` to confirm
clients are reaching the gateway, then check JWT validation logic.

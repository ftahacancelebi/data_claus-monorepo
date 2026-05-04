# DataClaus Runbook

Troubleshooting playbooks for the most common dev/demo issues. Each file
follows the `symptom → diagnostic → fix` shape and is short enough to fit
on one screen during an incident.

| Issue | Playbook |
|-------|----------|
| Ingest pipeline rejects every event | [ingest-rejecting-everything.md](ingest-rejecting-everything.md) |
| Schema doesn't match the entities | [migration-out-of-sync.md](migration-out-of-sync.md) |
| Dashboard WebSocket won't connect | [websocket-not-connecting.md](websocket-not-connecting.md) |
| Webhook deliveries fail or stall | [webhook-deliveries-failing.md](webhook-deliveries-failing.md) |
| Ledger invariant is broken | [ledger-invariant-broken.md](ledger-invariant-broken.md) |

Add new entries as patterns emerge. Keep them recent — a runbook nobody
trusts is worse than no runbook at all.

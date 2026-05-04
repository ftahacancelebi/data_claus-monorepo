# Capstone Q&A — Anticipated Questions & Live Answers

Each row pairs a likely jury question with a one-screen answer **and** the
live artifact that proves it. Show the artifact, don't just describe it.

| Question | Live answer | Artifact to show |
|----------|-------------|------------------|
| "How is the money safe?" | The double-entry invariant — every credit has a paired debit, the sum is always zero. | `psql … "SELECT SUM(amount) FROM ledger_transactions WHERE status='completed'"` returns `0`. Or `/admin/health/full` → `Ledger invariant: SUM=0`. |
| "How do you tell humans from bots?" | 7-layer SDK fraud detection + reCAPTCHA Enterprise + server-side anomaly checks. The payout multiplier is `1 - fraudScore`. | Slide 9 + the demo backend log line `HMAC verified, fraudScore=0.85 → REJECTED` when running an emulator probe. |
| "Does this scale?" | NestJS is horizontally stateless, Postgres handles capstone load with one node, the EventEmitter2 → Kafka swap is a single subscriber change. | `docker-compose.yaml` (Kafka container is ready) + the `score.calculated` event handler in `realtime.bridge.ts`. |
| "What about KVKK / GDPR?" | DSAR endpoint, soft-deletion with cooling-off, audit log on every privileged action. | `/legal/data-rights` page + `dsar.controller.ts` route + `audit_logs` table. |
| "Is Stripe real?" | Capstone uses simulation mode (`bank_simulation`/`crypto_simulation`); a single env flag flips to live mode once compliance is in place. | `payout-request.entity.ts` `PayoutMethod` enum + `STRIPE_SIMULATION` env in `.env.example`. |
| "What is your tech stack?" | NestJS 11, TypeORM, Postgres, EventEmitter2, Next.js 14, Socket.IO, Expo. | Slide 11 + `package.json` files. |
| "How do you do multi-tenancy?" | Every ledger row carries an `applicationId` and `developerId`. Postgres RLS scaffolding is in place. | `ledger-transactions.entity.ts` columns + `metadata` jsonb. |
| "Why no AI worker?" | The SDK fraud-detection + reCAPTCHA risk score made an isolation forest redundant for the capstone scope. | `memory-bank/implementation/00-master-plan.md` decision note (28 Apr 2026). |
| "What if the phone is jailbroken?" | The SDK detects emulator/jailbreak signals; reCAPTCHA Enterprise is the second gate; server-side replay guard catches the rest. | SDK `fraud-detection/jailbreak.ts` + `IngestValidator` log line. |
| "How do developers integrate?" | One npm install, one `init({apiKey})`, drop-in components for ads. ~10 min. | `packages/sdk-react-native/README.md` + the TikTok demo's `App.tsx`. |
| "Where does the platform fee go?" | A fixed 5% credited to the platform wallet (`SYSTEM_WALLET_IDS.PLATFORM`) on every payout. | `common/constants.ts` + a sample ledger row's metadata. |
| "What's left to ship?" | Phase 6 marketplace polish, Stripe live, Kafka swap, K8s deployment. | `memory-bank/implementation/00-master-plan.md` Phase 8 note. |

## Defensive answers (dispel misconceptions)

- **"Is this just AdMob with extra steps?"** AdMob attributes revenue to
  the developer; we attribute it to the user, the developer, and the
  platform with verifiable on-platform proof.
- **"What if developers fake events?"** Without a verified user JWT, no
  ledger entry happens — fake events earn $0 and waste their HMAC quota.
- **"Doesn't end-to-end fraud detection require ML?"** Layered detection
  catches >95% in our demo dataset; ML is a Phase 8 lift, not a blocker.

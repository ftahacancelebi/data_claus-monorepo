# Active Context

## Current Focus

**REVENUE SHARING & AUTH IMPLEMENTATION:** Implementing critical features for production-ready monetization.

We have now implemented:
1. ✅ Per-app revenue share configuration in app creation modal
2. ✅ User identity linking system (SDK + API types)
3. ✅ Ad revenue components (Banner, Interstitial, Rewarded)
4. ✅ Comprehensive SDK documentation
5. ✅ Platform documentation

## Active Decisions

1. **Per-App Revenue Share:** Each application can have its own user share percentage (50-90%). Platform fee is fixed at 5%.

2. **User Identity Linking:** Developers call `linkUser()` after authentication to connect their users to DataClaus accounts. Uses device fingerprinting for cross-app matching.

3. **Ad Revenue Flow:** Ads go through DataClaus to ensure verifiable revenue sharing. We provide AdView components that developers can't bypass.

4. **Webhook Integration:** Developers receive real-time notifications about user earnings, quality changes, and payouts via HMAC-signed webhooks.

## Recent Changes (2024-12-31)

### Frontend Enhancements:
- ✅ `my-apps/page.tsx` - Added revenue share slider with visual breakdown
- ✅ `docs/page.tsx` - Complete rewrite with comprehensive documentation
- ✅ `api.ts` - Extended with user linking, ads, and webhook APIs

### SDK Additions (React Native):
- ✅ `identity.ts` - User identity linking module with hooks
- ✅ `ads.tsx` - Banner, interstitial, rewarded ad components
- ✅ `README.md` - Complete SDK documentation

### Backend Updates:
- ✅ `application.go` - Added user_share_percent to request/response
- ✅ API types defined for user linking and ad revenue

### Documentation:
- ✅ `docs/PLATFORM.md` - Comprehensive platform documentation
- ✅ SDK README with full API reference
- ✅ Dashboard docs page with code examples

## New API Endpoints (Defined in Types)

### User Identity
- `POST /applications/:id/users/link` - Link external user
- `GET /applications/:id/users/external/:externalId` - Get by external ID
- `GET /users/:id/earnings` - Get user earnings

### Ads
- `GET /applications/:id/ads/config` - Get ad configuration
- `POST /applications/:id/ads/impression` - Record impression
- `GET /applications/:id/ads/summary` - Revenue summary

### Webhooks
- `POST /developers/:id/webhook-secret` - Generate secret
- `GET /developers/:id/webhook-secrets` - List secrets
- `DELETE /developers/:id/webhook-secrets/:secretId` - Revoke

## Revenue Share Model

```
┌─────────────────────────────────────────────┐
│         Revenue Distribution                 │
├─────────────────────────────────────────────┤
│                                              │
│   Total Revenue: $1.00                       │
│                                              │
│   ┌─────────────────────────────────────┐   │
│   │ User Share     │ 50-90% (configurable) │   │
│   ├─────────────────────────────────────┤   │
│   │ Developer Share │ 5-45% (remaining)     │   │
│   ├─────────────────────────────────────┤   │
│   │ Platform Fee   │ 5% (fixed)           │   │
│   └─────────────────────────────────────┘   │
│                                              │
│   Example (70% user share):                  │
│   User: $0.70, Developer: $0.25, Platform: $0.05 │
│                                              │
└─────────────────────────────────────────────┘
```

## To Make It Work

### 1. Start Infrastructure
```bash
cd /Users/tahacancelebi/Desktop/data_claus-monorepo
docker-compose up -d
```

### 2. Start Go Backend
```bash
cd apps/dataclaus-api
go run cmd/api/main.go
```

### 3. Frontend Already Running
The Next.js dev server is running on `http://localhost:3001`

## TODO: Backend Implementation

The following endpoints are defined in the frontend types but need backend handlers:

1. **User Identity Handlers:**
   - Create `UserIdentityHandler` with Link, GetByExternalId, GetEarnings
   - Create `DataClausUser` entity with wallet linking
   - Implement device fingerprint matching

2. **Ad Revenue Handlers:**
   - Create `AdHandler` with GetConfig, RecordImpression, GetSummary
   - Create `AdImpression` entity for tracking
   - Integrate with Google AdMob API

3. **Webhook Handlers:**
   - Create `WebhookSecretHandler` with Generate, List, Revoke
   - Implement HMAC signature generation
   - Create webhook dispatch system

## Files Modified

```
apps/dataclaus-web/
├── src/lib/api.ts                    # Extended with new APIs
├── src/lib/types.ts                  # Already has REVENUE_SHARES
├── src/app/dashboard/
│   ├── my-apps/page.tsx              # Revenue share slider added
│   └── docs/page.tsx                 # Complete rewrite

packages/sdk-react-native/
├── src/
│   ├── index.ts                      # Exports new modules
│   ├── identity.ts                   # User linking (NEW)
│   └── ads.tsx                       # Ad components (NEW)
└── README.md                         # Full documentation

apps/dataclaus-api/internal/adapters/http/
└── application.go                    # user_share_percent added

docs/
└── PLATFORM.md                       # Platform documentation (NEW)
```

---
*Last Updated: 2024-12-31 19:58*

## [UPDATE SUGGESTION] Recent Backend Changes (2026-01-04)

### NestJS Backend (Replacement for Go API):
- **Revenue Distribution Engine Implemented:** 
  - `AdsService` now directly credits `WalletService` upon modifying impressions.
  - Implemented `LedgerService` integration to record all financial transactions permanently.
  - Fixed logic where revenue was calculated but never distributed to users/developers.
- **Security Decisions:** 
  - Confirmed that Developers do not need a separate API Key for runtime application requests. The `Application ID` + `User Token` is sufficient for attribution.

---

## [2026-05-09] Anti-Bypass Slot/Seal Hardening (commit 6b1e42d → next)

### Why
SDK-trusted revenue (`recordImpression(adType, revenue)`) is forkable.
A jury-quality answer to "what stops a developer from skipping the user's
share?" must be **architectural**, not "trust the client".

### What changed
- `common/crypto/SigningService` — HMAC-SHA256 + nonce ledger + canonical JSON.
- `modules/ads/AdMediationService` — slot allocation + revenue reconciliation.
- `/ads/slot` + `/ads/seal` endpoints; `/ads/impression` now `@Roles(ADMIN)` only.
- `AdImpression.slotNonce` (unique partial idx), `sealedAt`, `revenueConfirmed`.
- SDK `requestSlot/sealImpression` cycle, `attestation.ts` provider hook,
  SHA-256 fingerprint (was zero-security `((hash<<5)-hash)+char`).
- `tiktok-backend /ads/impression` now internally runs slot+seal — mobile
  callers see one round-trip but get full anti-bypass guarantees.

### What's defensible now
- Replay: HMAC + in-memory nonce + DB unique partial idx (3 layers).
- Tampering: signature verification + canonical JSON.
- Revenue forging: server-side reconciliation, ±50% tolerance band, clamp + flag.
- Cross-app token reuse: app-id binding inside the slot payload.
- Forked SDK: ad-unit IDs are server-resolved, not in client config.

### Smoke test
`pnpm run smoke:slot-seal` exercises the happy path + replay + tamper +
out-of-tolerance scenarios. Run BEFORE the jury demo.

### Out of scope (intentional)
- Real Apple App Attest / Play Integrity backend (stub provider only).
- Buyer portal UI (economics simulated via `campaign-matcher`).
- Production observability (Sentry DSN env exists, wiring deferred).

---

## [2026-05-16] Data Package Marketplace Pivot — Demo Readiness

**Current focus is the marketplace pivot** (`memory-bank/implementation/08-data-package-marketplace-pivot.md`),
not the event-stream model above. The earlier "Revenue Sharing / event ingest"
sections in this file are historical — the pivot supersedes them (Kafka / Python
worker / per-event ingest are deprecated, not built).

### Audit verdict (2026-05-16)
Pipeline ~90% implemented and structurally sound. Demo steps 1–6 run end-to-end,
wired to real endpoints (not mock). `usePackage` polls every 2 s while
`evaluating` and self-stops on `certified` — the step-4 "wow" flip works.
Tables auto-create via `synchronize:true` (NODE_ENV=development); migration
`1715300000000-AddDataPackages.ts` is the backup. Seed produces 6 packages
across score ranges with pre-computed LLM evals (no live API call needed).

### Fixes applied (2026-05-16, commit pending)
1. **[CRITICAL] Seller earnings now update live on sale (spec §8 step 7).**
   `package.purchased` had no listener. Added `@OnEvent('package.purchased')`
   in `realtime.bridge.ts` → emits `wallet:credited` to the seller's
   `developer:` room (reuses the existing frontend cache-patch listener in
   `dashboard/wallet/page.tsx`, zero frontend change). Seller must have an
   open session on a page that listens (wallet page).
2. **[HIGH] Fee split corrected 95/5 → 90/10** (spec §12.2). Added a local
   `PACKAGE_FEE_RATE = 0.1` in `data-packages.service.ts`; removed the shared
   `PLATFORM_FEE_PERCENT` import there. **Did NOT touch the global constant**
   (=5%, governs the unrelated ads/payout pipeline).
3. **[HIGH] Double-purchase blocked.** `marketplace/[id]/page.tsx` now reads
   `useMyPurchases()`; `alreadyBought` disables the button + shows "Already
   purchased / View in Purchases". The purchase mutation already invalidates
   `purchases.all`, so the flip is in-render.
4. **[HIGH] "Campaigns" nav removed** from `sidebar.tsx` (spec §12.6 /
   acceptance #6 — no nav reference to the deprecated event flow). Route still
   exists, just unlinked. Orphaned `TrendUp` import also removed.

Both `apps/dataclaus-nestjs-api` and `apps/dataclaus-web` typecheck clean
after the changes.

### Still pending (owner: taiko)
- **#3 ANTHROPIC_API_KEY not in `apps/dataclaus-nestjs-api/.env`** — to be
  added LAST by taiko with the real key. Until then the live submission falls
  back to the deterministic stub (summary literally says "Set ANTHROPIC_API_KEY
  to enable the live AI auditor"). SDK installed, `LLM_MODEL` default OK, the
  catch-fallback is correct — only the env line is missing. The 6 seeded
  packages have hand-written evals, so the marketplace still looks populated;
  only the live-submission "Claude wrote this" moment is hollow without the key.

### Operational runbook note
`scripts/demo-seed.ts` uses `synchronize:false` — **boot the API once
(`pnpm run dev:api`, NODE_ENV=development auto-creates tables) BEFORE running
`pnpm run demo:seed`**, else inserts fail with "relation data_packages does
not exist". Not a code bug — a sequencing requirement.

### Stale doc flag
CLAUDE.md "Cookie auth + server-side middleware (now wired)" is **inaccurate**:
`src/middleware.ts` is currently a no-op (matcher disabled to avoid the
redirect loop). Client-side `<RequireAuth>`/`<RequireRole>` are the real gate.
Demo-safe (presenter is always logged in); flagged so it isn't trusted as
server-side protection.

### Revenue-surface hardening pass (2026-05-16, commit pending)
All money surfaces brought to senior-frontend-flow discipline + the
purchase→earnings socket loop now closes on the **main dashboard**, not only
the wallet page.

1. **`developer-dashboard.tsx`** — was `useEffect`+`getDashboard()`+`useState`
   with a catch that set fake zero stats + a dead *"Start the Go API"* banner
   (forbidden pattern #3, silent-error→empty). Now: `useDashboardStats()` +
   `useApiKeys()` hooks; honest error UI with a Retry button; a
   `wallet:credited` socket listener that invalidates `dashboard.stats` +
   `earnings.all` → seller's "Total Payouts" updates live on a sale
   (spec §8 step 7 on the dashboard surface); reconnect safety-net.
2. **`wallet/page.tsx`** — dead *"Backend not connected. Start the Go API"*
   error string replaced with the real query error message + a Retry button
   (also surfaces `payoutsQuery.error`); reconnect safety-net invalidates
   wallets/earnings/payouts after a dropped socket.
3. **Mutation onError — NOT added (intentional).** The approved design called
   for it, but verification showed both call sites already do try/catch→toast
   at the correct layer (`marketplace/[id]` purchase, `wallet` release-pending).
   `api-hooks.ts` has no toast context — adding onError there would be worse,
   not better. Connection points are already robust.

`apps/dataclaus-web` typecheck clean; no orphaned imports after the refactor.
Backend untouched this pass.

### Demo completeness audit — all roles + SDK + mobile (2026-05-16)
Web jury demo has **no CRITICAL/HIGH gap**. Verified role-readiness:
- **Developer / End-user(client) / Admin** journeys fully demo-ready. `user.alice`
  (role=user) lands on a dedicated, fully-wired `/u/*` portal with real seeded
  `ad_impressions` earnings — NOT the dev dashboard or a blank page.
- **Buyer landing — FIXED (2026-05-16, commit pending after d7355a7).**
  `buyer-dashboard.tsx` fully rewritten: real data via `useMyPurchases()` +
  `useWalletsByOwner()` (one cache layer), full loading/error/empty/success
  triad, working `<Link>` CTAs to `/dashboard/marketplace` (dead buttons
  gone), all "campaign" copy removed (spec §12.6). KPIs: Wallet Balance /
  Total Spent / Packages Owned / Avg Trust Score + Recent Acquisitions list
  (score gauge, links to marketplace detail). Read-only landing — no
  mutation, cache stays fresh via `usePurchasePackage` invalidation. tsc
  clean. Admin landing useEffect+fetch fragile = LOW, still open (demoable
  admin path `/dashboard/admin/packages` is solid, not blocking).
- **Mobile/SDK = deprecated side-showcase, OFF the jury critical path**
  (spec 08 §1 "Does NOT touch: TikTok demo app"; §8 demo is 100% web).
  SDK (`packages/sdk-react-native`) fully implemented but the TikTok app does
  NOT consume it (uses tiktok-backend + raw AdMob). Mobile money-loop BROKEN at
  one point: `apps/tiktok-backend/.env DATACLAUS_APP_ID=fd6036a9-…` not in
  seeded DB (seed gives "TikTok Clone" a fresh UUID; real one in JURY_LOGIN.md).
  Every `/ads/slot` → "Application not found" → 500. Login/feed/AdMob banner
  work. Fix (LOW, operational): paste real app UUID into tiktok-backend/.env
  after `demo:seed`, restart :4001. Don't demo mobile earnings/"Watch Ad" live
  unless fixed (shows error or fake "$0.0105").
- **Doc staleness**: `JURY_LOGIN.md:51` still says "95% seller / 5% platform" —
  the fee was changed to 90/10 (PACKAGE_FEE_RATE). Update the doc.

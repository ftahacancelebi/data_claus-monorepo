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

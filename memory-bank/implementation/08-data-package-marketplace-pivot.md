# 08 — Data Package Marketplace Pivot (MVP)

**Status:** spec, ready to implement
**Owner:** taiko
**Target:** demo-ready in 2-3 working days
**Replaces:** `01-data-pipeline.md` event-stream model, deprecates `06-marketplace-buyer.md` campaign/impression flow
**Does NOT touch:** wallet/ledger primitives (reused), auth/cookie/middleware (reused), TikTok demo app (separate showcase)

---

## 1. The Pivot in One Paragraph

DataClaus is no longer a real-time event router. It is an **AI-validated B2B data marketplace**: developers package behavioral data they collected themselves, submit it for *DataClaus AI Evaluation*, and list it for sale. Buyers browse certified packages, see Claude's independent audit (trust score + red flags + buyer-match), and purchase. Money flows through the existing wallet/ledger primitives unchanged.

**Why this pivot fits MVP & jury:**
- Story: "AWS Data Exchange + AI auditor" — clearer to non-technical jury than "Kafka + Isolation Forest"
- Demoability: static datasets > streaming flow (deterministic, debug-able)
- Tech leverage: shows real LLM integration, not toy fraud heuristic
- Infra collapse: Kafka, Python worker, real-time ingest path — all become optional / deferred
- Reuses 80% of existing schema (wallets, ledger, developers, applications)

---

## 2. Old vs New (Side-by-Side)

| Aspect | Old (event stream) | New (package marketplace) |
|---|---|---|
| Producer | App SDK ships per-event sensor data | Developer uploads pre-aggregated dataset package |
| Granularity | Single event row | Whole dataset (10–10k rows) |
| Transport | `/v1/ingest` HMAC POST (planned: Kafka) | `POST /v1/packages` JSON body, S3 later |
| Scoring trigger | Per event, synchronous, formula-based | Per package, async, LLM-based |
| Scorer | `qualityScore = 1 - fraudScore` (heuristic) | Claude (`claude-haiku-4-5` or `claude-sonnet-4-6`) |
| Settlement | Per-impression micro-payment via campaign | One-shot price-per-package, buyer-initiated |
| Buyer entity | Campaign (auto-matched) | Buyer (browses + clicks) |
| Demo angle | "money streams in" | "AI grades the data, buyer reads grade, buys" |

---

## 3. User Flows

### 3a. Developer (Seller)

1. Login → `/dashboard/packages/new`
2. Form: title, category, description, claimed_metrics (`{row_count, unique_users, date_range_start/end}`), schema JSON, sample rows JSON (5–10 rows), price USD
3. Submit → API stores row `status='evaluating'`, fires async LLM evaluation
4. UI polls / SSE → status flips to `certified` (with score) or `rejected` (with reason). 3-8 sec
5. Certified packages auto-listed in marketplace

### 3b. Buyer

1. Login → `/marketplace`
2. Filter: category, min trust score, price range
3. Card grid: title, developer name, big DataClaus-certified score (color-coded), price, "View" button
4. Detail page: full LLM summary, red flags, schema preview, sample rows preview, "Purchase" button
5. Purchase → ledger txn (buyer wallet → developer wallet + platform fee), `package_purchases` row, buyer gets access token / download link

### 3c. Admin

1. `/dashboard/admin/packages` — moderation list
2. Filter: certified, rejected, flagged
3. Click → see LLM eval JSON, manual override score, or force-relist/remove

---

## 4. Data Model

### 4a. New Tables

```sql
CREATE TYPE package_status AS ENUM ('pending', 'evaluating', 'certified', 'rejected', 'sold', 'delisted');

CREATE TABLE data_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    UUID NOT NULL REFERENCES developers(id),
  application_id  UUID REFERENCES applications(id),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL,  -- fitness, social, finance, entertainment, location, ...
  claimed_metrics JSONB NOT NULL,        -- { row_count, unique_users, date_range_start, date_range_end }
  schema_json     JSONB NOT NULL,        -- { field_name: "string"|"number"|"timestamp"|... }
  sample_rows     JSONB NOT NULL,        -- array of 5-10 objects
  price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  status          package_status NOT NULL DEFAULT 'pending',
  dataclaus_score NUMERIC(4,3),          -- nullable until evaluated
  llm_evaluation  JSONB,                 -- full Claude response (see §6c)
  evaluated_at    TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_packages_status_score ON data_packages (status, dataclaus_score DESC);
CREATE INDEX idx_packages_developer ON data_packages (developer_id);
CREATE INDEX idx_packages_category ON data_packages (category) WHERE status = 'certified';

CREATE TABLE package_purchases (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id             UUID NOT NULL REFERENCES data_packages(id),
  buyer_id               UUID NOT NULL,  -- references either dataclaus_users or a future buyers table; for MVP, reuse developers table with role='buyer'
  amount                 NUMERIC(10,2) NOT NULL,
  ledger_transaction_id  UUID REFERENCES ledger_transactions(id),
  download_token         VARCHAR(64),    -- one-time URL-safe token
  purchased_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchases_buyer ON package_purchases (buyer_id, purchased_at DESC);
CREATE INDEX idx_purchases_package ON package_purchases (package_id);
```

### 4b. Reused (no schema change)
- `developers`, `applications`, `wallets`, `ledger_transactions`, `audit_log`
- `dataclaus_users` — out of scope for this pivot

### 4c. Deferred / dormant (do NOT drop, just stop writing to them)
- `scored_events`, `ad_impressions`, `campaigns`, `webhook_*`, `otp_requests`
- `apps/dataclaus-nestjs-api/src/modules/ingest/*` — keep code, remove from dashboard nav, mark module `// DEPRECATED: superseded by data-packages`

---

## 5. API Surface

All under `/v1/packages/*`. Auth via existing cookie + JWT.

| Method | Path | Auth | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/v1/packages` | developer | `{ title, category, claimed_metrics, schema_json, sample_rows, price, description?, application_id? }` | `{ id, status: 'evaluating' }` |
| GET | `/v1/packages` | public (filtered) / authed | `?category=&min_score=&max_price=&page=` | `{ data: Package[], meta }` — only `certified` for non-admin |
| GET | `/v1/packages/:id` | public for certified, owner/admin for others | — | full Package + llm_evaluation |
| POST | `/v1/packages/:id/purchase` | buyer | `{}` | `{ purchase_id, download_token, ledger_transaction_id }` |
| GET | `/v1/packages/:id/download` | buyer (must have purchase) | `?token=` | redirect/stream (MVP: returns sample_rows + schema as JSON) |
| POST | `/v1/packages/:id/reevaluate` | admin | `{}` | `{ status: 'evaluating' }` |
| GET | `/v1/packages/mine` | developer | — | own packages, all statuses |

Validation: zod schema in `apps/dataclaus-nestjs-api/src/modules/data-packages/dto/*.dto.ts`. Same pattern as existing `ingest.dto.ts`.

---

## 6. LLM Evaluator

### 6a. Service shape

`apps/dataclaus-nestjs-api/src/modules/data-packages/package-evaluator.service.ts`

```ts
@Injectable()
export class PackageEvaluatorService {
  constructor(private readonly config: ConfigService) {}

  async evaluate(pkg: DataPackage): Promise<LlmEvaluation> {
    const prompt = buildPrompt(pkg);
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',  // fast, cheap; switch to sonnet-4-6 if quality lacks
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return parseStrictJson(response.content[0].text);  // schema-validated, throw on bad shape
  }
}
```

Called from the package creation flow as an async job — either via existing `EventEmitter2` (`'package.created'` listener) or a simple `setImmediate` for MVP. Update row to `status='certified'` or `'rejected'` based on score threshold (e.g. < 0.4 → rejected with reason).

### 6b. Prompt template

Stored in `package-evaluator.prompt.ts`. Single string template with `{{placeholders}}`.

```
You are DataClaus AI — an independent data-quality auditor for a B2B behavioral-data marketplace.

A developer has submitted a data package. Your job: evaluate whether the package matches its claims and is suitable for sale to buyers. Be skeptical but fair.

PACKAGE
- Title: {{title}}
- Category: {{category}}
- Description: {{description}}
- Claimed metrics: {{claimed_metrics_json}}
- Schema: {{schema_json}}
- Sample rows ({{sample_count}} of claimed {{claimed_row_count}}): {{sample_rows_json}}
- Asking price (USD): {{price}}

EVALUATION RUBRIC — score each 0.0–1.0:
1. schema_integrity — field types consistent, required fields present, null/anomaly rate reasonable
2. sample_diversity — distinct users/sessions, time range matches claim, values plausible
3. bot_signature_absence — flags for: repeated user-agents, sub-100ms intervals, zero jitter, dup fingerprints
4. claim_evidence_alignment — samples actually show what title/category/metrics claim
5. price_fairness — price per row vs. category baseline (fitness ~$0.001/row, social ~$0.0003/row, finance ~$0.01/row)

OUTPUT — strict JSON only, no prose outside the JSON:
{
  "trust_score": <weighted avg, 0.0–1.0>,
  "summary": "<2 sentences buyer-facing>",
  "red_flags": ["<short bullet>", ...],
  "buyer_match": ["<advertiser/buyer category>", ...],
  "rubric": {
    "schema_integrity": <0–1>,
    "sample_diversity": <0–1>,
    "bot_signature_absence": <0–1>,
    "claim_evidence_alignment": <0–1>,
    "price_fairness": <0–1>
  },
  "confidence": "high" | "medium" | "low",
  "verdict": "certified" | "rejected"
}
```

Weighted-avg formula (in code, not the LLM): `0.15*schema + 0.25*diversity + 0.30*bot_absence + 0.20*claim_align + 0.10*price`. We use the LLM's per-rubric scores; the LLM's own `trust_score` is a sanity check.

### 6c. Output schema (zod)

`apps/dataclaus-nestjs-api/src/modules/data-packages/llm-evaluation.schema.ts`

```ts
export const LlmEvaluationSchema = z.object({
  trust_score: z.number().min(0).max(1),
  summary: z.string().min(20).max(400),
  red_flags: z.array(z.string()).max(8),
  buyer_match: z.array(z.string()).min(1).max(6),
  rubric: z.object({
    schema_integrity: z.number().min(0).max(1),
    sample_diversity: z.number().min(0).max(1),
    bot_signature_absence: z.number().min(0).max(1),
    claim_evidence_alignment: z.number().min(0).max(1),
    price_fairness: z.number().min(0).max(1),
  }),
  confidence: z.enum(['high', 'medium', 'low']),
  verdict: z.enum(['certified', 'rejected']),
});
```

On parse failure: retry once with stricter instruction; if still bad, mark package `status='rejected'` with `red_flags: ['LLM evaluation failed to produce parseable output']`. Do NOT silently fail.

### 6d. Cost & latency budget

- Model: `claude-haiku-4-5-20251001` first; if score quality is too crude, escalate to `claude-sonnet-4-6`
- Avg input: ~1500 tokens (sample + prompt); output: ~400 tokens
- Cost per eval: ~$0.001–0.003 — negligible for demo
- Latency: 2–5 s — render evaluating spinner; SSE/poll for status

### 6e. Demo-time safety

Seed script pre-computes evaluations for the seeded packages and writes them directly to `llm_evaluation` — so the marketplace is full of certified packages BEFORE the demo starts. ONE package the jury submits live demonstrates real-time evaluation. If the live API call fails, fall back to a hard-coded "demo evaluation" so the demo never breaks.

---

## 7. Web UI

Pages added to `apps/dataclaus-web`. Re-use existing primitives: `senior-frontend-flow` rules, TanStack Query hooks in `lib/api-hooks.ts`, zod schemas in `lib/schemas.ts`, query keys in `lib/query-keys.ts`. NO new auth/middleware work.

| Route | Audience | Key Elements |
|---|---|---|
| `/dashboard/packages` | developer | List of own packages, status pills, scores, "New Package" button |
| `/dashboard/packages/new` | developer | Form (title, category select, claimed_metrics builder, schema editor with field-add UI, sample_rows JSON textarea with validate button, price input) → POST `/v1/packages` → redirect to detail with evaluating spinner |
| `/dashboard/packages/:id` | developer (own) | Status, score gauge, LLM summary, red flags, sample preview, edit/delist actions |
| `/marketplace` | buyer + public | Filter sidebar (category, score, price), card grid sorted by score DESC |
| `/marketplace/:id` | buyer + public | Hero score badge, full LLM eval, schema diagram, sample rows table, big "Purchase for $X" button |
| `/dashboard/purchases` | buyer | Past purchases, download links, expiry |
| `/dashboard/admin/packages` | admin | All packages, filter by status, force-reevaluate / override score / delist |

Sidebar nav update (`apps/dataclaus-web/src/components/layout/sidebar.tsx`):
- Add "Packages" (developer)
- Add "Marketplace" (buyer + developer)
- Add "Purchases" (buyer)
- Hide/remove (for MVP): "My Apps logs", "Campaigns" — these belong to the deprecated event flow

**Score visualization:** a single ring/gauge component, color: ≥0.85 green, 0.65–0.85 amber, <0.65 red. Reusable: `<DataclausScoreGauge value={0.87} size="lg" />`.

---

## 8. Demo Script (Jury Walkthrough — ~4 min)

| Step | Actor | Action | What jury sees |
|---|---|---|---|
| 1 | Developer (Fit & Move Labs) | Login at `/` → land on `/dashboard/packages` | Pre-seeded packages, one with 0.94 score, one with 0.71, one with 0.42 rejected — full marketplace context immediately |
| 2 | Developer | Click "New Package" → fill form (live!) with realistic fitness data | Form validates, sample-rows preview shows real JSON |
| 3 | Developer | Submit → redirected to detail page with "DataClaus AI is evaluating…" spinner | Genuine 3-4 sec wait — feels real |
| 4 | — | Status flips to "Certified — 0.88" with LLM-written summary visible | The wow moment: Claude wrote that summary live, jury reads it |
| 5 | Buyer (BrandOne) | Open new tab → `/marketplace` | Card grid; just-submitted package now visible at top |
| 6 | Buyer | Click new package → read LLM eval → click "Purchase for $X" | Confirmation modal, then ledger entry created |
| 7 | Developer | Switch back to seller tab — earnings card updates in real-time (existing WebSocket → React Query cache pattern) | The full loop: submit → AI grade → buyer purchase → seller paid, on screen in 4 min |
| 8 | Optional flex | Admin view shows the rejected (0.42) package's red flags in plain English | "Look — Claude caught the bot-like sample" |

**Backup plan if LLM call fails live (step 3):** stub the response with a pre-recorded evaluation JSON; demo continues without break.

---

## 9. Implementation Phases

### Phase 1 — Backend skeleton (Day 1, ~6h)
- [ ] Migration: create `data_packages` + `package_purchases` tables + indexes
- [ ] NestJS module `data-packages/` with: entity, dto, controller, service, evaluator service stub (returns hard-coded eval for now)
- [ ] Endpoints: POST/GET/GET-list/POST-purchase wired to in-memory dummy
- [ ] Wire `package.purchased` event → existing wallet/ledger service for buyer→developer settlement (+ 10% platform fee, same pattern as `ads.service.ts`)
- [ ] Unit test: purchase creates ledger txn with correct splits

### Phase 2 — LLM integration (Day 1 evening + Day 2 morning, ~5h)
- [ ] Add `@anthropic-ai/sdk` to API package
- [ ] Env: `ANTHROPIC_API_KEY` + `LLM_MODEL` in `apps/dataclaus-nestjs-api/.env.example`
- [ ] Real `PackageEvaluatorService` with prompt template + zod-validated parse
- [ ] Wire as async listener on `package.created` event
- [ ] Threshold logic: trust_score < 0.4 → `status='rejected'`, else `'certified'`
- [ ] Manual test: submit 3 packages (good, mediocre, obvious bot), verify Claude grades differ as expected

### Phase 3 — Web UI (Day 2, ~6h)
- [ ] `lib/schemas.ts`: zod for Package + LlmEvaluation + Purchase
- [ ] `lib/api.ts` + `lib/api-hooks.ts`: `usePackages`, `usePackage(id)`, `useCreatePackage`, `usePurchasePackage`, `useMyPackages`
- [ ] `lib/query-keys.ts`: package + purchase keys
- [ ] Pages: `/dashboard/packages`, `/dashboard/packages/new`, `/dashboard/packages/[id]`, `/marketplace`, `/marketplace/[id]`, `/dashboard/purchases`, `/dashboard/admin/packages`
- [ ] Score gauge component
- [ ] Sidebar nav update — add new entries, hide deprecated ones
- [ ] `<RequireAuth>` / `<RequireRole>` on each route

### Phase 4 — Seed + Demo polish (Day 3, ~3h)
- [ ] Update `scripts/demo-seed.ts`: insert 6 packages (2 excellent, 2 mid, 1 rejected, 1 pending), pre-compute and store LLM evaluations directly (no live API calls during seed by default; flag `--with-llm` to actually call)
- [ ] Update `JURY_LOGIN.md` to reflect new flows
- [ ] End-to-end smoke test: `scripts/smoke-test-package-marketplace.ts` — login dev, create package, wait for eval, login buyer, purchase, verify wallets
- [ ] Manual run of full demo script, time it, fix friction points

### Phase 5 — Cleanup (½ day, optional, do AFTER demo)
- [ ] Remove `kafka` + `kafka-ui` services from `docker-compose.yaml`
- [ ] Mark `modules/ingest`, `modules/ads`, `modules/campaigns` as DEPRECATED in code comments + remove from sidebar nav (already done in Phase 3)
- [ ] Update `memory-bank/systemPatterns.md` to reflect new architecture
- [ ] Update `memory-bank/productContext.md` with new user journey

---

## 10. Explicitly Out of Scope (Deferred)

- Actual data delivery (download_token → S3 signed URL). MVP returns sample_rows JSON only.
- Schema-builder UI beyond a JSON textarea + zod validate button
- Refund / dispute flow
- Subscription / repeated-access pricing tiers
- Multi-tenant data isolation beyond ownership check
- Buyer onboarding KYC
- Webhook notifications for new packages
- Search / full-text indexing
- LLM evaluation re-runs on schedule
- Anti-jailbreak hardening of the prompt
- Real-time event ingest (stays deprecated for entire MVP timeline)
- Kafka (removed)
- Python ML worker (never built, stays not-built)

---

## 11. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Anthropic API down during demo | low | Pre-computed seed evaluations; live submission has fallback to canned response |
| LLM returns unparseable JSON | medium | Strict zod schema + 1 retry + reject-with-reason if still bad |
| Cost runaway during testing | low | Use Haiku (~$0.001/eval); cap requests/min with a simple in-memory rate limiter |
| Sample row JSON too large → token overflow | low | Hard cap: max 10 sample rows, max 200 chars per field — enforced in DTO validation |
| Buyer/Developer role overlap on existing `developers` table | medium | For MVP reuse `developers` table with `role` ENUM ('developer'|'buyer'|'admin') as currently done; document clearly. Don't create new `buyers` table — wastes a day |
| Score gauge UX feels stale (no animation) | low | Cinematic-but-cheap CSS animation on first render (300ms fill-up); jury notices polish |
| Live demo step 3 takes >10 sec | low-medium | Pre-warm: open the page beforehand, model name in env, retry on timeout, fallback after 8 sec |

---

## 12. Acceptance Criteria (Definition of Done)

This pivot is "done for MVP" when:

1. Developer can submit a package via the UI and see it get a Claude-generated trust score and summary
2. Buyer can browse certified packages and complete a purchase that creates correct ledger entries (buyer wallet −X, developer wallet +0.9X, platform wallet +0.1X)
3. Demo script (§8) runs end-to-end in under 4 minutes with no manual SQL or DevTools required
4. Seed script produces a credible marketplace state (≥6 packages across score ranges)
5. `JURY_LOGIN.md` reflects what's actually demoable
6. No reference in the UI nav to the deprecated event-stream flow (ingest, campaigns, impressions) — those routes can still exist, just not in the user-facing nav

---

## 13. Open Decisions (need taiko's call before coding starts)

1. **Buyer entity** — reuse `developers` table with `role='buyer'` (recommended, 0 schema change), OR new `buyers` table (cleaner, +0.5 day)?
2. **Model** — start with `claude-haiku-4-5` (recommended, fast + cheap), or sonnet from the start?
3. **Phase 5 cleanup** — do it before demo (clearer story, +½ day risk) or after (safer)?
4. **Package access after purchase** — sample_rows JSON only for MVP, or implement S3 signed URL now (out-of-scope but possible)?
5. **"Buyer wallet seeding"** — current $500 enough, or top up to $5000 so jury can do multiple purchases?

Once these are answered, Phase 1 can start.

# DataClaus — System Architecture

> Capstone-scope architecture overview. Mermaid diagrams render natively on
> GitHub and most documentation viewers (mkdocs, Notion, GitLab).

---

## 1. High-Level Component Map

```mermaid
flowchart LR
    subgraph mobile["📱 Mobile"]
        SDK["@dataclaus/sdk-react-native<br/>Auth · Identity · Ads · Sensors"]
        DemoApp["TikTok-Clone Demo App<br/>(Expo)"]
        SDK -.embeds.-> DemoApp
    end

    subgraph proxy["🔁 Developer Backend (per-tenant)"]
        TBE["tiktok-backend<br/>(Node.js)<br/>HMAC envoy + auth proxy"]
    end

    subgraph core["🏛️ DataClaus Core"]
        API["NestJS API<br/>:3000"]
        Web["Next.js Dashboard<br/>:3001 incl. /jury console"]
    end

    subgraph data["💾 Data Plane"]
        PG[(Postgres<br/>ledger · users · impressions)]
        Kafka[(Kafka<br/>ingest.raw_data<br/>ingest.scored_events)]
    end

    subgraph ai["🧠 Quality Engine"]
        Worker["Python Worker<br/>Isolation Forest<br/>Jitter + Timing variance"]
    end

    DemoApp -- "Bearer / HMAC" --> TBE
    TBE -- "internal HMAC" --> API
    DemoApp -. "user-scoped REST<br/>(slot/seal · earnings)" .-> API
    API <--> PG
    API -- "publish" --> Kafka
    Kafka -- "consume" --> Worker
    Worker -- "score callback" --> API
    API -- "WebSocket /realtime" --> Web
    Web <--> PG
```

**Key boundaries:**
- **Mobile SDK** never holds an app's HMAC secret — it goes through the
  developer's own backend (`tiktok-backend`) for HMAC-required ingestion
  flows. User-scoped REST (slot/seal, earnings) goes direct with a Bearer
  token.
- **Kafka** is the buffer between hot-path ingestion (sub-100ms) and the
  Python worker (seconds to minutes). API never blocks on AI scoring.
- **Ledger** (Postgres) is the source of truth for every cent. Double-entry
  invariant cron validates it.

---

## 2. Slot/Seal Impression Flow (Anti-Bypass)

```mermaid
sequenceDiagram
    autonumber
    participant App as Mobile App
    participant SDK as @dataclaus/sdk
    participant API as NestJS API
    participant DB as Postgres
    participant AdMob as AdMob SDK

    App->>SDK: requestSlot('rewarded')
    SDK->>API: POST /ads/slot {appId, userId, attestation}
    API->>API: SigningService.sign(payload, 5min TTL)
    API-->>SDK: {slot_token, ad_unit_id, projected_revenue}
    SDK->>App: AdSlot
    App->>AdMob: load(ad_unit_id) → render
    AdMob-->>App: EARNED_REWARD event
    App->>SDK: sealImpression(slot, {reportedRevenue})
    SDK->>API: POST /ads/seal {slot_token, reported_revenue}
    API->>API: verify HMAC + nonce + expiry
    API->>DB: INSERT ad_impression (slot_nonce UNIQUE)
    Note over API,DB: replay = unique constraint violation
    API->>API: reconcileRevenue(client vs server projection)
    API->>DB: ledger transfer (atomic):<br/>AD_NETWORK → user / dev / platform
    API-->>SDK: ImpressionResponse
    API-->>Web: WS /realtime { wallet.credited }
```

**Defense layers (in order of triggering):**
1. JWT bearer → caller authenticated
2. App-id binding in slot payload → token can't move between apps
3. HMAC-SHA256 verify → tampered payload rejected
4. Expiry check → 5min TTL kills harvested tokens
5. In-memory nonce ledger → intra-process replay rejected
6. DB `slot_nonce` unique partial idx → cross-process / post-restart replay rejected
7. Revenue reconciliation → clamp + suspicious flag if client lies

---

## 3. Data Pipeline (Ingest → Score → Payout)

```mermaid
flowchart TB
    subgraph hotpath["Hot path (< 100ms)"]
        E[Sensor event] --> Validate[ingest-validator]
        Validate --> RawTopic[("Kafka<br/>ingest.raw_data")]
    end

    subgraph aipath["AI scoring (async)"]
        RawTopic --> AIWorker[Python Worker]
        AIWorker --> ScoredTopic[("Kafka<br/>ingest.scored_events")]
    end

    subgraph payout["Payout & ledger"]
        ScoredTopic --> Ingest[ingest.service]
        Ingest --> Match{campaign-matcher}
        Match -->|match| BuyerWallet[Buyer wallet -]
        Match -->|fallback| AdNetwork[AD_NETWORK system wallet]
        BuyerWallet & AdNetwork --> Split[revenue split]
        Split --> UserWallet[User wallet +]
        Split --> DevWallet[Developer wallet +]
        Split --> PlatformFee[Platform wallet +]
    end

    UserWallet --> Invariant[ledger-invariant cron<br/>SUM debits = SUM credits]
    DevWallet --> Invariant
    PlatformFee --> Invariant
```

---

## 4. Entity / Domain Map

```mermaid
erDiagram
    Developer ||--o{ Application : creates
    Developer ||--|| Wallet : owns
    DataClausUser ||--|| Wallet : owns
    DataClausUser ||--o{ AdImpression : earns_from
    Application ||--o{ AdImpression : generates
    Application ||--o{ ScoredEvent : sources
    AdImpression ||--o{ LedgerTransaction : creates
    Wallet ||--o{ LedgerTransaction : participates
    Campaign ||--o{ AdImpression : funds
    DataClausUser ||--o{ PayoutRequest : requests
    Developer ||--o{ WebhookEndpoint : registers
    WebhookEndpoint ||--o{ WebhookDelivery : produces
    AuditLog }o--|| DataClausUser : actor

    AdImpression {
        uuid id PK
        uuid application_id FK
        uuid user_id FK
        uuid developer_id FK
        uuid campaign_id FK "nullable (fallback eCPM)"
        enum ad_type
        decimal gross_revenue
        decimal user_share
        decimal dev_share
        decimal platform_fee
        varchar slot_nonce UK "unique partial idx"
        timestamp sealed_at
        boolean revenue_confirmed
    }
```

---

## 5. Security Model (Per-Layer)

| Layer | Threat | Control |
|-------|--------|---------|
| Mobile SDK | Forked SDK fakes revenue | Server resolves ad-unit + revenue |
| API ingress | Replay attack | HMAC + nonce + DB unique idx |
| API ingress | Brute force | `ThrottlerModule` 10/sec + 100/min |
| Auth | OTP enumeration | reCAPTCHA Enterprise + per-phone rate limit |
| Ledger | Race condition / partial commit | TypeORM transaction + `ledger-invariant` cron |
| KVKK / GDPR | Data subject access | `/dsar` module |
| KVKK / GDPR | Audit trail | `audit.interceptor` + `AuditLog` entity |
| Webhook delivery | MITM tampering | HMAC-signed payloads + secret rotation |

---

## 6. Out of Capstone Scope

- **Buyer portal UI** — economics simulated via `campaign-matcher.service`
- **Real Stripe Connect** — payouts simulated, regulatory work out of scope
- **Production attestation** — App Attest / Play Integrity stub (host app
  registers real provider in production)
- **Multi-network ad mediation** — AdMob only; AppLovin / Unity Ads
  roadmap'te
- **Production observability stack** — Sentry / Datadog hook'lar mevcut
  (`SENTRY_DSN` env), wiring deployment fazına bırakıldı

---

*Generated as part of capstone deliverables. For runbook see
`docs/runbook/`. For poster layout see `POSTER.md`.*

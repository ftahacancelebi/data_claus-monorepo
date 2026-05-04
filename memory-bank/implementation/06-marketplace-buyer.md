# Phase 6 — Marketplace & Buyer Portal

> **Hedef:** "Adv-Tech Layer: Buyer'ların data stream'lerine bid verdiği simüle edilmiş pazaryeri" (`projectbrief.md`). Buyer rolü için ayrı dashboard, kampanya oluşturma, bid sistemi, advertiser raporları.
>
> **Felsefe Bağlantısı:** "Reklam verenlerin harcadığı bütçe, sadece birkaç büyük tekel platformun kasasına girmek yerine, tabana yayılır." — `philosophy.md`. Bu fazın çıktısı, **paranın nereden geldiğini** kanıtlar.

## 1. Mevcut Durum (Doğrulanmış)

| Konu | Durum |
|------|-------|
| `BuyerDashboard` component | ✅ Var (placeholder) |
| `CampaignModule` (NestJS) | ✅ Var ama basic CRUD |
| `Campaign` entity | ✅ Var ama basit |
| `data-products` page (web) | ⚠️ Boş iskelet |
| `marketplace` page (web) | ⚠️ Boş iskelet |
| `campaigns` page (web) | ⚠️ Var ama UI eksik |
| Bid sistemi | ❌ Yok |
| Buyer wallet (debit ad spend) | ⚠️ Wallet entity'si destekliyor ama akış yok |
| Advertiser raporları (impression rate, CTR) | ❌ Yok |

## 2. Kapsam

### 2.1. Buyer Onboarding

`POST /auth/register` `role: 'buyer'` zaten destekleniyor. Buyer'lara özel:
- Onboarding tour (role-aware).
- "Top up wallet" akışı (capstone'da Stripe simulation, deposit).
- Tax/billing info (basic, capstone'da skeleton).

### 2.2. Campaign Lifecycle

```
Draft → Pending Review → Active → Paused → Completed/Cancelled
```

#### 2.2.1. Campaign Entity Genişletmesi

```typescript
@Entity('campaigns')
export class Campaign extends BaseEntity {
  @Column() buyerId: string;            // user (buyer role) id
  @Column() name: string;
  @Column({ type: 'text' }) description: string;

  // Targeting
  @Column({ type: 'jsonb' }) targeting: {
    appCategories?: string[];           // 'social', 'fitness', 'gaming'
    countries?: string[];
    minQualityScore?: number;           // 0–1
    deviceTypes?: ('ios' | 'android')[];
  };

  // Bidding
  @Column({ type: 'decimal', precision: 10, scale: 6 })
  bidPerImpression: number;             // CPM / 1000

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  totalBudget: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  spentBudget: number;

  @Column({ type: 'varchar', length: 16 })
  status: 'draft' | 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';

  @Column({ type: 'timestamp', nullable: true }) startsAt: Date | null;
  @Column({ type: 'timestamp', nullable: true }) endsAt: Date | null;

  // Performance counters
  @Column({ type: 'int', default: 0 }) impressionsServed: number;
  @Column({ type: 'int', default: 0 }) uniqueUsersReached: number;
}
```

#### 2.2.2. Campaign Service — Bid Auction

Şu an `AdsService.recordImpression` doğrudan `AD_NETWORK` cüzdanından debit yapıyor. **Yeni model:**

1. Impression geldiğinde `CampaignMatcherService.matchEligibleCampaigns(application, user)` çağrılır.
2. Eligible campaign'lar arasında **second-price auction** veya **highest-bid first**.
3. Kazanan campaign'in `bidPerImpression` kadar `buyer wallet → ad_network wallet` debit edilir.
4. Sonra mevcut split (user/dev/platform) çalışır.

```typescript
// modules/campaign/campaign-matcher.service.ts
async matchAndCharge(applicationId: string, userId: string, qualityScore: number): Promise<{ campaignId: string; bidAmount: number } | null> {
  const candidates = await this.campaignRepo.find({
    where: {
      status: 'active',
      // Targeting filter via JSONB query
    },
    order: { bidPerImpression: 'DESC' },
  });

  for (const c of candidates) {
    if (c.spentBudget + c.bidPerImpression > c.totalBudget) continue;
    if (c.targeting.minQualityScore && qualityScore < c.targeting.minQualityScore) continue;
    // ... more checks ...

    // Atomic charge buyer wallet
    try {
      await this.financialTx.runInTransaction(async (qr) => {
        await this.financialTx.transferAtomic(
          qr,
          await this.getBuyerWallet(c.buyerId, qr),
          AD_NETWORK_WALLET_ID,
          c.bidPerImpression,
          c.id,
          TransactionType.AD_SPEND,
        );
        c.spentBudget = Number(c.spentBudget) + c.bidPerImpression;
        c.impressionsServed++;
        await qr.manager.save(c);
      });
      return { campaignId: c.id, bidAmount: c.bidPerImpression };
    } catch (e) { /* try next */ }
  }
  return null;
}
```

**`AdsService.recordImpression` refactor:**
- `grossRevenue = matchedCampaign.bidAmount` (eğer match yoksa default eCPM).
- Devam: user/dev/platform split aynı kalır.
- Eşleşme bilgisi `AdImpression.campaignId` kolonuna yazılır (entity'ye eklenir).

### 2.3. Buyer Web UI

#### 2.3.1. `/dashboard` (BuyerDashboard)
- "Active campaigns" kartı (count + total budget).
- "Spend this month" + "Impressions delivered".
- "Wallet balance" + "Top up" CTA.

#### 2.3.2. `/dashboard/campaigns`
- Liste: campaign'ler tablo halinde (name, status, budget, spent, impressions, CTR).
- "New Campaign" butonu.
- Quick toggle: pause / resume.

#### 2.3.3. `/dashboard/campaigns/new`
- Multi-step form:
  1. Basics: name, description, dates.
  2. Targeting: app categories, countries, min quality score.
  3. Bid & budget: CPM input + total budget.
  4. Review + submit (status: `pending`).

#### 2.3.4. `/dashboard/campaigns/[id]`
- Detail page: stats, performance graph, recent impressions log.
- Edit / pause / cancel buttons.

#### 2.3.5. `/dashboard/marketplace` (Discovery)
- Buyer'lar için "available data products" listesi.
- Bir Application = bir data product (geliştiricinin tanımladığı şekilde).
- "Bid on this stream" butonu — direkt campaign create flow'a yönlendirir.

#### 2.3.6. `/dashboard/data-products` (Developer için)
- Geliştirici, app'inin "data product" olarak public marketplace'te listelenmesini ayarlar.
- Description, categories, pricing floor (min CPM).

### 2.4. Reports & Analytics (Buyer)

`/dashboard/campaigns/[id]/analytics`:
- Impressions over time (LineChart).
- Quality distribution (BarChart): kaç impression `>0.7`, `0.4–0.7`, `<0.4`.
- App breakdown: hangi app'lerden gelme.
- CSV export.

### 2.5. Backend Endpoint Listesi

| Method | Path | Role |
|--------|------|------|
| POST | `/buyer/wallet/topup` | buyer |
| GET | `/buyer/wallet` | buyer |
| GET | `/campaigns?mine=true` | buyer |
| POST | `/campaigns` | buyer |
| GET | `/campaigns/:id` | buyer |
| PATCH | `/campaigns/:id` | buyer |
| POST | `/campaigns/:id/pause` | buyer |
| POST | `/campaigns/:id/resume` | buyer |
| POST | `/admin/campaigns/:id/approve` | admin |
| GET | `/campaigns/:id/analytics` | buyer (own) / admin |
| GET | `/marketplace/data-products` | buyer / public |
| PATCH | `/applications/:id/data-product` | developer |

### 2.6. Real-Time Buyer Feed

Phase 4 WebSocket ile buyer dashboard'da:
- "Live impressions": Kampanyana her impression geldiğinde 1 satır akar.
- Spend gauge canlı yükselir.

WS event: `campaign:impression { campaignId, applicationId, qualityScore, bidAmount }`.

## 3. Adım Adım Implementasyon

### Adım 1 — Campaign Entity Genişlet
- [ ] Targeting JSONB, status enum, performance counters.
- [ ] Migration.

### Adım 2 — Campaign Service
- [ ] CRUD operasyonlar (mevcut'u genişlet).
- [ ] `pause/resume/approve` actions.
- [ ] Validation: bid < budget, dates sane, etc.

### Adım 3 — CampaignMatcher
- [ ] `matchAndCharge` core logic.
- [ ] AdsService entegrasyonu.
- [ ] Fallback: hiç campaign yoksa default eCPM kullan.

### Adım 4 — Buyer Wallet Top-Up
- [ ] `BuyerWalletService.topUp` (Stripe simulation).
- [ ] Atomic credit (Phase 2 helper).

### Adım 5 — Web Pages
- [ ] BuyerDashboard rewrite.
- [ ] `/dashboard/campaigns` table + actions.
- [ ] `/dashboard/campaigns/new` multi-step form.
- [ ] `/dashboard/campaigns/[id]` detail + analytics.
- [ ] `/dashboard/marketplace` data product list.

### Adım 6 — Real-Time Buyer Feed
- [ ] WS event tip: `campaign:impression`.
- [ ] Live gauge + ticker.

### Adım 7 — Reports
- [ ] Analytics endpoint (aggregate query).
- [ ] CSV export.

### Adım 8 — Test
- [ ] E2E: buyer signup → top-up → create campaign → trigger impression → see live update → see analytics.

## 4. Dosya Değişiklikleri Özeti

### Yeni
```
apps/dataclaus-nestjs-api/src/modules/campaign/
  campaign-matcher.service.ts
  campaign-analytics.service.ts
  campaign-analytics.controller.ts

apps/dataclaus-nestjs-api/src/modules/marketplace/
  marketplace.module.ts
  marketplace.controller.ts
  marketplace.service.ts

apps/dataclaus-web/src/app/dashboard/
  campaigns/new/page.tsx
  campaigns/[id]/page.tsx
  campaigns/[id]/analytics/page.tsx
  marketplace/page.tsx (rewrite)
  data-products/page.tsx (rewrite)

apps/dataclaus-web/src/components/buyer/
  BuyerDashboard.tsx (rewrite)
  CampaignTable.tsx
  CampaignFormStep1.tsx (..2, 3, 4)
  TargetingBuilder.tsx
  CampaignAnalytics.tsx
  LiveSpendGauge.tsx
```

### Değişen
- `modules/campaign/campaign.entity.ts`
- `modules/campaign/campaign.service.ts`
- `modules/ads/ads.service.ts` (matchAndCharge entegrasyonu)
- `modules/ads/entities/ad-impression.entity.ts` (campaignId)
- `app.module.ts` (MarketplaceModule)
- `apps/dataclaus-web/src/components/dashboards/buyer-dashboard.tsx`

## 5. Test Stratejisi

| Senaryo | Beklenen |
|---------|----------|
| Buyer top up $100 | Wallet balance 100, ledger row var |
| Campaign create & approve | Status: active, search'te görünür |
| Trigger impression | Buyer wallet -bidAmount, AD_NETWORK +bidAmount, sonra split |
| Min quality score 0.7, user 0.5 | Eşleşme yok, default eCPM (veya skip) |
| Bütçe biter | `spentBudget >= totalBudget`, status: completed |
| Buyer dashboard | Live spend gauge artar |
| CSV export | 1000 row, indirilebilir |

## 6. Definition of Done

- [ ] Buyer signup → wallet top up → campaign create → live impression akar.
- [ ] Campaign matcher eligible olanları sıralıyor, atomic charge yapıyor.
- [ ] Buyer dashboard'da canlı spend ve impression metrik'leri görünür.
- [ ] Analytics page line + bar chart + breakdown çalışıyor.
- [ ] Marketplace listesi developer'ların aktif app'lerini gösteriyor.
- [ ] Admin review akışı: pending → approve/reject.
- [ ] CSV export bug'sız.
- [ ] E2E test PASS.

## 7. Tahmini Süre

- Backend (campaign extend + matcher + marketplace): **1.5 gün**
- Frontend (buyer pages + forms + charts): **1.5 gün**
- Real-time + analytics + test: **1 gün**

**Toplam: 3–4 iş günü.**

## 8. Bağımlılıklar

- **Önce:** Phase 1 (impression akışı), Phase 2 (atomic ledger), Phase 4 (live feed).
- **Sonra:** Phase 7 (demo seed: hazır 3 örnek campaign jüri için).

## 9. Capstone Önceliği

> Phase 6 capstone teslimatı için **opsiyoneldir**. Eğer süre dar kalırsa:
> - Sadece **Buyer top-up** + **basit campaign create** + **AD impression matched campaign** akışı yeter.
> - Marketplace, advanced reports, multi-step form ileri sürüme bırakılabilir.
> - Capstone değerlendirmesi için demo'da 1 buyer + 1 active campaign yeterli.

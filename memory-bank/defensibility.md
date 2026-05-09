# DataClaus Defensibility Strategy

> Projeyi YC-seviyesinde savunmak için referans dokümanı.
> Yatırımcı sorularına ve mimari kararlarına bu dosya kaynak olur.

---

## 1. Architectural North Star

DataClaus, kapsam itibarıyla "developer revenue üzerinde verification layer"
modelinden başlar; hedef yörünge ise **demand-side ad inventory aggregator**
(Stripe Connect–style flow-of-funds): para developer hesabına HİÇ uğramadan
DataClaus üzerinden split edilir. Bu evrim üç fazda:

| Faz | Mimari | Mevcut Durum |
|-----|--------|--------------|
| 1. Verification layer | Slot/seal flow ile server-authoritative revenue | ✅ Tamamlandı (commit 6b1e42d) |
| 2. Hybrid demand | DataClaus direct buyer relationships + AdMob fallback | 🟡 Roadmap |
| 3. Full aggregator | DataClaus = merchant-of-record, developer payout receiver | 🔴 12+ ay |

---

## 2. Anti-Bypass Defense Layers (Bugünkü Durum)

SDK kodu fork edilebilir — bu inkâr edilemez. Defense, **kodu gizlemek
yerine sunucu tarafında resolution** yapmaya dayanır.

| # | Katman | Ne Yapar |
|---|--------|----------|
| 1 | HMAC-SHA256 imza | Tampered slot token reddedilir |
| 2 | 5dk TTL | Long-lived token harvesting blocklanır |
| 3 | In-memory nonce ledger | Tek instance içinde replay engellenir |
| 4 | DB unique partial idx (`ad_impressions.slot_nonce`) | Çok-instance + restart sonrası replay engellenir |
| 5 | App-id binding | Token başka uygulamada kullanılamaz |
| 6 | Server-side revenue resolution | Client-reported revenue cross-check sinyali, ledger değil |
| 7 | Server-issued ad-unit IDs | Forklenmiş SDK doğru AdMob hesabını bilemez |
| 8 | Platform attestation hook | Production'da `attestationVerified=false` reddedilebilir |

**Net mesaj:** Bypass teknik olarak mümkün ama **ekonomik olarak anlamsız**.

---

## 3. Moats Roadmap (Hamilton Helmer 7 Powers)

| Power | Bugün | 1 Yıl | 3 Yıl |
|-------|-------|-------|-------|
| **Counter-Positioning** | ✅ | ✅ | ✅ |
| **Network Economies** | — | 🟡 Two-sided flywheel | ✅ |
| **Scale Economies** | — | — | ✅ Fraud ML at 10M+ events/day |
| **Switching Costs** | 🟡 Pending balances | ✅ User wallet history | ✅ |
| **Process Power** | — | 🟡 Quality scoring | ✅ |
| **Cornered Resource** | — | 🟡 Verified human pool | ✅ Regulatory licenses |
| **Branding** | — | 🟡 "Brave of mobile apps" | ✅ |

**Bugünkü ana moat:** Counter-Positioning. Google/Meta surveillance
capitalism'i bırakıp users'a ödeme yapamaz — kendi LTV'lerini öldürürdü.
Innovator's Dilemma.

---

## 4. Platform Risk Mitigation

**Tehdit:** AdMob/AdSense ToS değişikliği — "üçüncü taraf revenue share
yasak" hükmü konursa platform owner = rakip senaryosu (Perfect Audience–
Facebook precedent, YC `Iz` videosu).

**Azaltma:**
1. Direct buyer ilişkileri kur (gaming şirketleri, AI training data buyer'ları,
   market research firmaları) — AdMob'a bağımlı olmamak için
2. Mobile = entry channel, core business değil. Asıl iş = verified human
   behavior data marketplace
3. Multi-network mediation: AdMob, Unity Ads, AppLovin paralel

---

## 5. Investor Q&A — Hazır Cevaplar

### Soru: "Developer neden bypass etmesin? %100 AdMob > %95 DataClaus."
**Cevap (3 katman):**
1. **Ekonomik:** Verified-human inventory %200-300 eCPM premium komutlar.
   `0.95 × 3.0 > 1.00 × 1.0`.
2. **User-side:** Userlar app'i DataClaus payout'u için kullanıyor. Bypass =
   user app'i terk eder.
3. **Reputational:** "DataClaus Verified" badge marketplace discovery sinyali.

### Soru: "Google bunu 6 ayda klonlar."
**Cevap:** Google'ın iş modeli kullanıcıdan veri **almak**. Kullanıcıya ödeme
yapmak Google'ın LTV'sini öldürür — Innovator's Dilemma. Microsoft
Teams Slack'e karşı dağıtım avantajıyla kazandı; Google'ın bu yeni iş
modelini destekleyen dağıtım avantajı YOK.

### Soru: "Apple/Google ToS değiştirir, biter."
**Cevap:** Bu yüzden demand-side aggregator'a yürüyoruz. Mobile = giriş
kanalı. Core marketplace AdMob'a bağımlı değil.

### Soru: "Unit economics?"
**Cevap:** Take rate %5 platform fee (gross). User share 50-90% configurable
per-app. CAC: developer-side viral (B2B2C). LTV: developer LTV ≠ user LTV,
iki ayrı funnel.

### Soru: "Regulatory yangının ortasındasınız."
**Cevap:** Bu **bizim moat'ımız**. Surveillance capitalism öldükçe
"consented, paid data" modeli ayakta kalan tek model. KVKK Article 5(1)(a)
explicit consent + Article 11 withdrawal hakları zaten mimarinin kalbinde
(`/dsar` modülü, `/audit` modülü).

---

## 6. Technical Defensibility Audit (Mevcut Repo)

| Komponent | Defensibility | Notlar |
|-----------|---------------|--------|
| `common/crypto/signing.service.ts` | ✅ HMAC + nonce + canonical JSON | Production secret rotation roadmap'te |
| `modules/ads/ad-mediation.service.ts` | ✅ Slot allocation + revenue reconcile | Tolerance band ±50% |
| `modules/ads/ads.service.ts#sealImpression` | ✅ Atomic transaction + ledger | DB unique idx replay protection |
| `modules/ledger/ledger-invariant.service.ts` | ✅ Cron-based double-entry validation | Test coverage var |
| `modules/audit` | ✅ Decorator-based audit logging | KVKK trail |
| `modules/dsar` | ✅ Data subject access request | KVKK Article 11 |
| SDK `attestation.ts` | 🟡 Stub provider | Production: react-native-app-attest |
| SDK `identity.ts#hashFingerprint` | ✅ SHA-256 (3-tier) | expo-crypto / Web Crypto / pure-JS |

---

## 7. Out of Capstone Scope (Bilinçli Tercih)

| Komponent | Durum | Gerekçe |
|-----------|-------|---------|
| Buyer portal UI | Simulated via `campaign-matcher` | Capstone scope: data flow + AI quality + ledger |
| Real Stripe Connect | Simulated payouts | Mali/lisans regulatory dışında |
| Production attestation backend | Stub | iOS/Android native module gerek |
| Multi-network ad mediation | Sadece AdMob | MVP focus |
| Sentry/Datadog | Yok | Demo localhost odaklı |

---

*Last updated: 2026-05-09*
*Trigger: Slot/seal hardening commit `6b1e42d`*

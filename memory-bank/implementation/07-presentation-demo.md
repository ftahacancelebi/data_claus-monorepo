# Phase 7 — Presentation, Demo Polish & Capstone Teslim

> **Hedef:** Capstone (bitirme) jürisinin önünde 7 dakikalık akıcı bir demo gerçekleştirmek. Ekran boş kalmaz, her tıklama anlamlı veri gösterir, "shake → earn" akışı dramatik biter, jürinin sorabileceği teknik soruların hepsi canlı olarak ledger sorgusu / backend log / WebSocket akışı ile cevaplanır.
>
> **Felsefe Bağlantısı:** "Demo, bir vaadin canlı kanıtıdır." Tüm önceki fazların bütünlüğü bu sunumla görünür hale gelir. (Bkz. `00-master-plan.md` §5.)

## 1. Mevcut Durum (Doğrulanmış)

| Konu | Durum |
|------|-------|
| Demo seed script | ❌ Yok |
| Sentetik kullanıcı/event üretici | ❌ Yok (k6 vs. yok) |
| Slide deck | ❌ Yok |
| Demo videosu | ❌ Yok |
| Capstone teslim klasörü | ❌ Yok |
| Onboarding README (10dk'da kurulum) | ⚠️ progress.md'de notlar var ama tek dosya yok |
| Health-check sayfası (jüri için "her şey yeşil") | ❌ Yok |
| Bilinen edge case'lerin runbook'u | ❌ Yok |

## 2. Kapsam

### 2.1. Demo Seed Script

#### `scripts/demo-seed.ts` (Node TS)

```typescript
// Yapı:
// 1. 3 developer create (different email)
// 2. Her developer için 1 application (differing user_share_percent: %60, %70, %85)
// 3. 5 end-user create (OTP simulation)
// 4. 2 buyer + topped-up wallets ($500 each)
// 5. 3 active campaigns (cinema, fitness, social targeting)
// 6. 100 ad impressions geçmişe yayılı (last 7 days)
// 7. 50 scored events (mix of human/bot)
// 8. 2 payout requests (1 completed, 1 pending)
// 9. Webhook endpoint'leri register

// Çıktı:
// - JURY_LOGIN.md → tüm hesapların email/parola/role'leri
// - Console: Reset komutu hatırlatması
```

**Komut:**
```bash
pnpm run demo:seed       # idempotent, mevcut demo verisi varsa skip
pnpm run demo:reset      # tüm tabloları temizle ve seed et
pnpm run demo:replay     # canlı demo için son 1dk event replay
```

### 2.2. Live Replay Tool

`scripts/demo-replay.ts`:
- 5 saniyede bir TikTok mobile'dan gelmiş gibi event üretir.
- WebSocket connected dashboard'da grafikler hareket etmeye devam eder.
- Demo sırasında jüri "tamam ama bu zaten canlı mı?" diye sorduğunda **kontrol** etmek için.

### 2.3. Dashboard "Live Health" Sayfası

`/dashboard/admin/health/page.tsx` (sadece admin):
- 🟢 NestJS API: 200ms response
- 🟢 PostgreSQL: connected, 12 connections
- 🟢 Ingest pipeline: last event 2sec ago, accept rate %94
- 🟢 EventEmitter: 47 events/min
- 🟢 WebSocket: 4 connected clients
- 🟢 Ledger Invariant: SUM = 0.0000 ✓
- 🟢 Webhook outbox: 0 unprocessed deliveries

Demo'nun sonunda jüriye "Tüm sistem yeşil" göstermek için.

### 2.4. Jury Quick-Access Pano

`/jury` (public, password-protected):
- 1 tıklama: "Login as End-User Demo" → otomatik token + redirect.
- 1 tıklama: "Login as Developer Demo".
- 1 tıklama: "Login as Buyer Demo".
- 1 tıklama: "Login as Admin Demo".
- "Live Stream" embed: Phase 4 WS realtime feed direct preview.

### 2.5. Slide Deck (`docs/presentation/`)

**Slide listesi (12 slide, 7 dakika):**

| # | Konu | Süre |
|---|------|------|
| 1 | Title + tagline ("Big Tech Knows When You're Awake. We Make Sure You Get Paid for It.") | 0:10 |
| 2 | Problem: Surveillance Capitalism (görsel + 3 madde) | 0:30 |
| 3 | Solution: DataClaus 1-pager (mimari diagram) | 0:45 |
| 4 | "Quality = Money" (felsefe) | 0:30 |
| 5 | LIVE DEMO başlıyor — dashboard turu | 1:00 |
| 6 | LIVE DEMO — telefonu salla, akış | 1:30 |
| 7 | LIVE DEMO — canlı grafikler + cüzdan + withdraw | 1:30 |
| 8 | Mimari deep-dive (HMAC + EventEmitter + Double-Entry) | 0:30 |
| 9 | Quality Engine (SDK fraud-detection katmanları + reCAPTCHA) | 0:30 |
| 10 | Roadmap (Phase 6 marketplace, mainnet, mobile pure SDK) | 0:15 |
| 11 | Tech Stack özeti | 0:10 |
| 12 | Q&A açılışı + iletişim | 0:30 |

**Format:** Reveal.js veya PowerPoint export. `docs/presentation/slides.md` (markdown) + `slides.pptx` build.

### 2.6. Demo Video

`docs/presentation/demo.mp4` (3 dk):
- Hızlı kesim, voice-over Türkçe.
- 0:00–0:20 problem.
- 0:20–1:00 dashboard turu.
- 1:00–2:00 telefon shake → grafik hareket.
- 2:00–2:30 withdraw + ledger query.
- 2:30–3:00 outro.

**Backup için:** demo günü canlı çalışmazsa video açılır.

### 2.7. README.md Yenileme (Repo Kökü)

Mevcut yok / yetersiz. Yeni README:

1. **Vision tagline** (1 satır).
2. **Live demo link** (varsa).
3. **Quick start (10 min):**
   ```bash
   git clone ...
   cp .env.example .env
   docker-compose up -d
   pnpm install
   pnpm run demo:seed
   pnpm run dev:all
   open http://localhost:3001/jury
   ```
4. **Architecture diagram** (mermaid).
5. **Repo layout.**
6. **Phase status** (00-master-plan'a link).
7. **License + Capstone notu.**

### 2.8. Runbook & Troubleshooting

`docs/runbook/`:
- `ingest-rejecting-everything.md`
- `migration-out-of-sync.md`
- `websocket-not-connecting.md`
- `webhook-deliveries-failing.md`
- `ledger-invariant-broken.md`

Her dosya: symptom + diagnostic command + fix.

### 2.9. Soru-Cevap Hazırlığı

`docs/presentation/qa-prep.md`:

| Olası Soru | Hazır Cevap |
|------------|-------------|
| "Para nasıl güvende?" | Live ledger query: `SELECT SUM(amount) FROM ledger_transactions` → 0 |
| "Bot'u nasıl ayırıyorsunuz?" | SDK fraud-detection katmanları gösterilir (motion patterns, emulator detect, reCAPTCHA Enterprise risk score), server-side reject log canlı |
| "Ölçeklenir mi?" | NestJS stateless replica + Postgres connection pool + outbox pattern; Phase 8'de Kafka geçişi tek `@OnEvent` → consumer değişikliği |
| "KVKK ne durumda?" | `/legal/data-rights` sayfası, DSAR endpoint çalıştır |
| "Stripe gerçek mi?" | "Capstone simülasyon, ama production toggle hazır (`STRIPE_SIMULATION=false`)" |
| "Hangi teknolojiler?" | NestJS + TypeORM + Postgres + EventEmitter2 + Next.js + Socket.IO + Expo. Slide 11. |
| "Bot accuracy?" | SDK fraud-detection 7 katman + reCAPTCHA Enterprise (Google'ın ML'i) — slide 9. |
| "Multi-tenancy?" | applicationId her ledger row'unda, RLS hazır iskelet. |

### 2.10. Demo Günü Checklist

`docs/presentation/checklist.md`:

```
T-24h:
[ ] Ledger invariant test çalıştır (SUM = 0)
[ ] Demo seed reset
[ ] scored_events tablosu temiz
[ ] Slide deck export edildi
[ ] Demo video hazır
[ ] Backup laptop senkronize

T-2h:
[ ] Network test
[ ] WebSocket connection test
[ ] Telefon şarjlı, SDK build güncel
[ ] Tüm pencereler hazır (5 tab: dashboard, kafka UI, terminal logs, slides, video)

T-15m:
[ ] Replay script ready as backup
[ ] OBS / screen recording başlatıldı
[ ] Mic test
```

## 3. Adım Adım Implementasyon

### Adım 1 — Demo Seed Script
- [ ] `scripts/demo-seed.ts` yaz.
- [ ] `package.json` script'leri ekle.
- [ ] Idempotent (tekrar çalıştırınca patlar değil).

### Adım 2 — Health Page
- [ ] Backend: `GET /admin/health/full` aggregate endpoint.
- [ ] Frontend: `/dashboard/admin/health/page.tsx` polling 2sn.

### Adım 3 — Jury Quick-Access
- [ ] `/jury` page (auth bypassed for special demo tokens).
- [ ] One-click login flows.

### Adım 4 — Replay Tool
- [ ] `scripts/demo-replay.ts` 5sn'lik aralıklarla random user'a impression at.

### Adım 5 — README.md
- [ ] Tek sayfada her şey, mermaid mimari diyagramı.

### Adım 6 — Slide Deck
- [ ] Markdown slide'lar (Reveal.js veya Marp).
- [ ] PPTX export.
- [ ] PDF backup.

### Adım 7 — Demo Video
- [ ] Senaryo yazılır.
- [ ] OBS ile çekim.
- [ ] DaVinci / iMovie kesim + voice-over.
- [ ] `docs/presentation/demo.mp4` (max 3dk).

### Adım 8 — Runbook
- [ ] 5 troubleshooting dosyası.

### Adım 9 — QA Prep
- [ ] 8+ olası soru için hazır cevap.

### Adım 10 — Final Polish
- [ ] Microcopy gözden geçir (felsefe yansıması).
- [ ] Tüm hardcoded "mock" / "TODO" / "FIXME" yorumları clean.
- [ ] Lighthouse audit (web > 85 mobil).
- [ ] Accessibility hızlı tarama (axe).

### Adım 11 — Dry Run
- [ ] Tam demo provası 3 kez.
- [ ] Süre tut, sapmalarsa kes.
- [ ] Backup video ile re-test.

### Adım 12 — Submit
- [ ] Capstone teslim klasörü:
  ```
  /submission/
    README.md
    presentation/
      slides.pdf
      slides.pptx
      demo.mp4
    docs/
      architecture.md
      runbook/...
    source/  → repo'ya symlink veya zip
  ```

## 4. Dosya Değişiklikleri Özeti

### Yeni
```
scripts/demo-seed.ts
scripts/demo-replay.ts
scripts/demo-reset.ts

docs/presentation/
  slides.md
  slides.pptx
  slides.pdf
  demo.mp4
  qa-prep.md
  checklist.md

docs/runbook/
  ingest-rejecting-everything.md
  migration-out-of-sync.md
  websocket-not-connecting.md
  webhook-deliveries-failing.md
  ledger-invariant-broken.md

apps/dataclaus-web/src/app/jury/page.tsx
apps/dataclaus-web/src/app/dashboard/admin/health/page.tsx
apps/dataclaus-nestjs-api/src/modules/admin/admin-health.controller.ts

README.md (rewrite)
JURY_LOGIN.md (auto-generated)
```

### Değişen
- `package.json` (scripts: demo:seed, demo:replay, demo:reset, dev:all)
- Repo kökü `.env.example`

## 5. Test Stratejisi

| Senaryo | Beklenen |
|---------|----------|
| `pnpm demo:seed` cold start | 30sn içinde tüm verisi hazır |
| `pnpm demo:reset` | Postgres truncate, scored_events temiz, idempotent |
| Demo replay 3dk | 36 event, dashboard'da görünür hareket |
| Health page | Tüm yeşil; bir servisi kapat → kırmızı |
| Jury login butonu | 1 tıklama → role'e uygun dashboard |
| Slide deck | PDF açılıyor, fontlar gömülü |
| Demo video | 1080p, 3 dakikadan az |
| README quick start | Sıfırdan kurulum 10 dakikadan az |

## 6. Definition of Done

- [ ] Demo seed komutu çalışıyor, jüri için 5 kullanıcı hazır.
- [ ] `/jury` sayfası çalışıyor, hızlı login mevcut.
- [ ] Live health page tüm servisleri yeşil gösteriyor.
- [ ] Slide deck PDF + PPTX hazır, 7 dakika içinde anlatılıyor.
- [ ] Demo video 3dk, indirilebilir.
- [ ] README sıfırdan kurulum talimatı doğrulandı.
- [ ] 5 runbook dosyası yazılı.
- [ ] QA prep listesi 8+ soru hazır.
- [ ] Demo dry-run 3 kez başarılı.
- [ ] Capstone teslim klasörü oluşturuldu.

## 7. Tahmini Süre

- Demo seed + replay + health: **0.5 gün**
- Slide deck + video: **0.5 gün**
- README + runbook + QA prep: **0.5 gün**
- Dry-run + final polish: **0.5 gün**

**Toplam: 2 iş günü.**

## 8. Bağımlılıklar

- **Önce:** Tüm önceki fazlar (özellikle 1, 2, 4) tamamlanmış olmalı. Phase 5 (user portal) ve Phase 6 (marketplace) yarı kalsa bile demo'da skip edilebilir.

## 9. Sunum Sonrası

Capstone değerlendirmesinden sonra:
- Geri bildirimleri toplayıp `progress.md`'ye ekle.
- "Lessons Learned" dosyası: ne çalıştı, ne çalışmadı.
- Yeni `memory-bank/post-capstone.md` dosyasında **production rollout planı** (Phase 8+).

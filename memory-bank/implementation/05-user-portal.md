# Phase 5 — User Portal (End-User Web Experience)

> **Hedef:** Bir DataClaus end-user'ı (TikTok-clone'u kullanan birey) DataClaus web sitesine girince **kazançlarını görür, çekim yapar, geçmişine bakar, hesabını yönetir.** Bu, "kullanıcı verisinin sahibi" felsefesinin somut görünür tarafıdır.
>
> **Felsefe Bağlantısı:** "İnsanlar verilerinin ve zamanlarının bir bedeli olduğunu fark eder. Platformda sadece vakit öldürmezler; o platformun büyümesinden doğrudan maddi fayda sağlarlar." — `philosophy.md`

## 1. Mevcut Durum (Doğrulanmış)

| Konu | Durum |
|------|-------|
| User dashboard component (`user-dashboard.tsx`) | ✅ Var |
| `/dashboard/wallet/page.tsx` | ✅ Var (developer + user shared) |
| Withdraw flow | ❌ Yok (Phase 2'de eklenecek) |
| App-bazında earnings breakdown | ❌ Yok |
| Session geçmişi (hangi app'te ne kadar süre, kazanç) | ❌ Yok |
| Quality score grafiği (zamanla nasıl değişti) | ❌ Yok |
| Account settings (profil, email değişikliği, parola) | ⚠️ Kısmi |
| KVKK/GDPR data export | ❌ Yok (Phase 3'le) |
| Onboarding tour kullanıcılar için | ⚠️ Component var, user-rolü için içerik yok |
| User-side route group `/(user)/` | ❌ Yok (her şey `/dashboard` altında) |

## 2. Kapsam

### 2.1. Bilgi Mimarisi

```
/                           → Public landing
/login                      → OTP login
/register                   → New user OTP signup
/(user)/dashboard           → Ana özet (toplam kazanç, son aktivite)
/(user)/earnings            → Detaylı kazanç ekranı
   ├── overview             → Dashboard'a benzer ama daha derin
   ├── by-app               → Hangi app'ten ne kadar
   ├── history              → Tüm ledger satırları (filtrelenebilir)
   └── quality              → Quality score grafiği + açıklama
/(user)/withdraw            → Withdraw talebi
/(user)/sessions            → Aktif/geçmiş oturumlar (cihazlar)
/(user)/account             → Profil, parola, KVKK
/(user)/legal               → Privacy, ToS, KVKK rights
```

> **Not:** `/dashboard/...` developer'a, `/(user)/...` end-user'a. Login sonrası role'e göre yönlendirilir.

### 2.2. Sayfa Detayları

#### 2.2.1. `/(user)/dashboard` — Ana Özet

**Bölümler:**
- **Hero card:** "Bu ay $X.XX kazandın" + son 7 gün kazanç sparkline.
- **Live ticker:** Phase 4 WebSocket'inden gelen son event'ler (max 5).
- **Quality score badge:** 0–1 skala + label (Excellent / Good / Improving).
- **Connected apps:** kullanıcının hangi DataClaus app'lerine bağlı olduğu.
- **Quick actions:** "Withdraw", "Connect new app", "Settings".

#### 2.2.2. `/(user)/earnings/by-app`

Her app için kart:
- App ikonu + adı.
- Bu app'ten kazanç (lifetime).
- Bu hafta delta.
- Quality score (bu app'teki aktivite ortalaması).
- "View details" → app bazlı ledger detayı.

API: `GET /me/earnings/by-app` → array of `{ applicationId, appName, totalEarned, last7Days, qualityScoreAvg }`.

#### 2.2.3. `/(user)/earnings/history`

Tablo (DataTable + filter):
- Date, Type (ad_revenue, payout, fee), Application, Amount, Status.
- Filter: date range, type, app.
- Export CSV.

API: `GET /me/ledger?from=&to=&type=&applicationId=&page=` → paginated.

#### 2.2.4. `/(user)/earnings/quality`

- Line chart: günlük ortalama quality score (son 30 gün).
- Açıklama paragrafı: "Quality score nedir? Nasıl artırılır?"
- "Tips" kartı: "Cihazını gerçekten kullan, otomatik araçlardan kaçın."

#### 2.2.5. `/(user)/withdraw`

- Mevcut bakiye + threshold uyarısı.
- Method seç: `Bank Simulation`, `Crypto Simulation`.
- Amount input + min/max validation.
- Onay modalı + KVKK metni.
- Status tracker: Requested → Approved → Completed.

API'ler Phase 2'de tanımlanan `/payouts/...` endpoint'leri.

#### 2.2.6. `/(user)/sessions`

- Aktif oturumlar (cihaz, IP, son aktivite, geçerli mi?).
- "Logout this device" / "Logout all".
- Geçmiş oturumlar (audit log filtrelenmiş).

API: `GET /me/sessions`, `DELETE /me/sessions/:id`, `DELETE /me/sessions`.

#### 2.2.7. `/(user)/account`

- Profil: display name, avatar (upload).
- Email (verify status).
- Parola değiştir (mevcut OTP doğrulamalı).
- 2FA toggle (TOTP — opsiyonel, capstone'da skeleton).
- "Hesabımı sil" → 30 gün cooling-off (Phase 3).
- Data export → ZIP indir (Phase 3 DSAR).

### 2.3. UX Detayları

- **Onboarding tour:** İlk login'de 3 adım (Welcome → How it works → Connect first app).
- **Empty states:** Henüz bağlı app yoksa "Connect Your First App" CTA.
- **Loading states:** Skeleton everywhere (Phase 4 realtime entegrasyonu).
- **Mobile-first:** Bu portal **end-user için**, çoğu telefondan girer; tüm sayfalar responsive.
- **Dark mode:** Default light, toggle dark.
- **i18n:** TR/EN minimum, JSON tabanlı.

### 2.4. Dil ve Ton (Felsefe yansıması)

Microcopy felsefik vaadi yansıtır:
- ❌ "Account balance: $5.20"
- ✅ "Bu hafta zamanından $5.20 kazandın. Bu, normalde Big Tech'e gidiyordu."

(Optional: Phase 7'de copy iyileştirmesi.)

### 2.5. KVKK/GDPR Görünür Hale Getirme

- Footer'da "Verilerin nasıl kullanılıyor?" linki.
- Settings altında "Data Rights" sekmesi.
- Cookie banner reddederse analytics yüklenmez (Phase 3).

## 3. Adım Adım Implementasyon

### Adım 1 — Route Group
- [ ] `apps/dataclaus-web/src/app/(user)/layout.tsx` oluştur.
- [ ] Auth check: `useAuth().role !== 'user'` ise redirect.
- [ ] Yeni navigation component (`UserSidebar`).

### Adım 2 — User-Side API'ler
- [ ] `GET /me/earnings/by-app` — backend (DataClausUserController).
- [ ] `GET /me/ledger` — pagination + filter.
- [ ] `GET /me/quality-score-history` — son 30 gün rolling.
- [ ] `GET /me/sessions` (DataClausUser session entity yeni).
- [ ] `DELETE /me/account` — soft delete + 30 gün cooling.

### Adım 3 — Sayfalar
- [ ] `/(user)/dashboard/page.tsx`
- [ ] `/(user)/earnings/[tab]/page.tsx` (overview, by-app, history, quality)
- [ ] `/(user)/withdraw/page.tsx`
- [ ] `/(user)/sessions/page.tsx`
- [ ] `/(user)/account/page.tsx`

### Adım 4 — Komponentler
- [ ] `EarningsHeroCard`
- [ ] `LiveTicker` (Phase 4 hook'undan beslenir)
- [ ] `QualityScoreBadge`
- [ ] `AppEarningsCard`
- [ ] `LedgerTable` (DataTable wrapper)
- [ ] `WithdrawModal`
- [ ] `SessionCard`

### Adım 5 — Onboarding Tour
- [ ] Yeni `UserOnboardingTour` component.
- [ ] localStorage `user_onboarded_v1` flag.
- [ ] 3 adım slide.

### Adım 6 — i18n
- [ ] `next-intl` veya `react-i18next` kur.
- [ ] `messages/tr.json`, `messages/en.json`.
- [ ] Critical sayfalar TR'ye çevrilir.

### Adım 7 — Test
- [ ] Playwright e2e: signup → first app connect → ad event → see earnings.
- [ ] Mobile responsive snapshot tests.

## 4. Dosya Değişiklikleri Özeti

### Yeni
```
apps/dataclaus-web/src/app/(user)/
  layout.tsx
  dashboard/page.tsx
  earnings/page.tsx
  earnings/by-app/page.tsx
  earnings/history/page.tsx
  earnings/quality/page.tsx
  withdraw/page.tsx
  sessions/page.tsx
  account/page.tsx

apps/dataclaus-web/src/components/user/
  UserSidebar.tsx
  EarningsHeroCard.tsx
  LiveTicker.tsx
  QualityScoreBadge.tsx
  AppEarningsCard.tsx
  LedgerTable.tsx
  WithdrawModal.tsx
  SessionCard.tsx
  UserOnboardingTour.tsx

apps/dataclaus-web/messages/
  en.json
  tr.json

apps/dataclaus-nestjs-api/src/modules/dataclaus-user/
  session/session.entity.ts
  session/session.service.ts
  session/session.controller.ts
```

### Değişen
- `apps/dataclaus-web/src/lib/auth-context.tsx` (role-based redirect)
- `apps/dataclaus-web/src/lib/api.ts` (new endpoints)
- `apps/dataclaus-nestjs-api/src/modules/dataclaus-user/dataclaus-user.controller.ts` (yeni endpoints)

## 5. Test Stratejisi

| Senaryo | Beklenen |
|---------|----------|
| Signup yeni email | OTP gönderilir, /(user)/dashboard'a düşer, hero'da "$0.00" |
| App'te ad event'i tetikle | Live ticker'a satır gelir, hero balance artar |
| Withdraw < threshold | "Insufficient balance" hatası |
| Withdraw geçerli amount | Status: Requested, admin approve sonrası Completed |
| Session logout-all | Tüm tab'larda anında 401 |
| Account delete | 30 günlük geri alma uyarısı |
| TR dilinde gezme | UI metinleri Türkçe |

## 6. Definition of Done

- [ ] `/(user)/...` route grubu çalışıyor, role guard aktif.
- [ ] Hero card lifetime + son 7 gün doğru gösteriyor.
- [ ] By-app breakdown gerçek verilerle dolu.
- [ ] Ledger history filtre + CSV export çalışıyor.
- [ ] Quality score grafiği son 30 günü çiziyor.
- [ ] Withdraw flow uçtan uca (Phase 2'deki payout API ile).
- [ ] Session management ekranı.
- [ ] Mobil responsive (Lighthouse mobile > 85).
- [ ] TR/EN dil değişimi sayfa reload'suz.
- [ ] Onboarding tour ilk login'de gösteriliyor, sonrasında skip.
- [ ] Account delete + data export end-to-end.

## 7. Tahmini Süre

- Backend endpoint'ler: **0.5 gün**
- Frontend sayfalar + komponentler: **1.5 gün**
- i18n + onboarding + test: **0.5 gün**

**Toplam: 2–3 iş günü.**

## 8. Bağımlılıklar

- **Önce:** Phase 2 (withdraw API'ler), Phase 3 (OTP login + DSAR), Phase 4 (live ticker).
- **Sonra:** Phase 7 (kopya iyileştirme + demo seed kullanıcı).

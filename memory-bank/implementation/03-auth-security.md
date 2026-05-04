# Phase 3 — Auth & Security

> **Hedef:** Kimlik doğrulama, API güvenliği ve webhook güvenilirliğini production-grade seviyeye çıkarmak. OTP akışı, HMAC sıkılaştırma, rate-limit, secret rotation ve webhook dispatcher.
>
> **Felsefe Bağlantısı:** "Kullanıcılar verilerinin sahibidir" iddiası, **kimlik doğrulamanın güvenliği** kanıtlanmadan boştur. KVKK/GDPR uyumu için minimum güvenlik tabanı bu fazda atılır.

## 1. Mevcut Durum (Doğrulanmış)

| Konu | Durum |
|------|-------|
| Auth strategy (developer + user) | ✅ Email + password (bcrypt + JWT) çalışıyor |
| OTP / phone-based auth | ❌ Hiç yok (entity'de `phone` bile yok, plan'da ise zorunlu) |
| reCAPTCHA Enterprise | ⚠️ SDK'da modül var, **backend doğrulama yok** |
| HMAC guard | ⚠️ Sınıf var, hiçbir route'ta `@UseGuards(HmacGuard)` ile kullanılmıyor |
| Rate limiting | ❌ `@nestjs/throttler` import yok, brute-force'a açık |
| Webhook dispatcher | ❌ Yok |
| Secret rotation | ❌ Yok (API key'ler tek kez basılıyor, expire/rotate akışı yok) |
| Audit log | ❌ Yok |
| KVKK/GDPR uyum sayfaları | ❌ Yok |

## 2. Kapsam

### 2.1. OTP-Based Authentication

#### 2.1.1. Plan vs Reality Reconciliation

`implementation_plan.md` (legacy) → phone + OTP, `auth.controller.ts` (gerçek) → email + password.

**Karar:** **Her ikisi de desteklensin.**
- **Developer login:** email + password (mevcut, dokunulmaz).
- **End-user login:** email + OTP (yeni, ana akış) **veya** phone + OTP (gelecek).

#### 2.1.2. OTP Akışı

| Method | Path | Public? | Açıklama |
|--------|------|---------|----------|
| POST | `/auth/user/request-otp` | ✅ | `{ email, recaptchaToken }` → 6 haneli kod gönder |
| POST | `/auth/user/verify-otp` | ✅ | `{ email, code }` → JWT döner |
| POST | `/auth/user/refresh` | ✅ | `{ refreshToken }` → yeni access token |

**Implementation:**
```typescript
// auth.service.ts
async requestOtp(email: string, recaptchaToken: string) {
  await this.recaptcha.verifyEnterprise(recaptchaToken, 'OTP_REQUEST');
  const code = generateCode();  // 6 hane, crypto-random
  const hash = await bcrypt.hash(code, 10);
  await this.otpRepo.save({
    email, codeHash: hash,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),  // 5dk
    attempts: 0,
  });
  await this.emailService.sendOtp(email, code);
  // Capstone modunda: console.log(`[OTP] ${email} -> ${code}`)
}

async verifyOtp(email: string, code: string): Promise<AuthResponse> {
  const otp = await this.otpRepo.findValid(email);  // not expired, not used
  if (!otp || otp.attempts >= 5) throw new UnauthorizedException();

  const valid = await bcrypt.compare(code, otp.codeHash);
  otp.attempts++;
  if (!valid) {
    await this.otpRepo.save(otp);
    throw new UnauthorizedException();
  }

  otp.usedAt = new Date();
  await this.otpRepo.save(otp);

  // Find or create user
  let user = await this.userRepo.findOne({ where: { email } });
  if (!user) {
    user = await this.createUserWithWallet(email);
  }
  user.emailVerified = true;
  user.lastLoginAt = new Date();
  await this.userRepo.save(user);

  return this.buildAuthResponse(user);
}
```

#### 2.1.3. Yeni Entity: `OtpRequest`

```typescript
@Entity('otp_requests')
export class OtpRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() email: string;
  @Column() codeHash: string;
  @Column() expiresAt: Date;
  @Column({ default: 0 }) attempts: number;
  @Column({ nullable: true }) usedAt: Date | null;
  @Column({ nullable: true }) ipAddress: string | null;
  @CreateDateColumn() createdAt: Date;

  @Index()
  @Column({ generatedType: 'STORED', asExpression: `lower(email)` })
  emailLower: string;
}

CREATE INDEX idx_otp_email_active ON otp_requests(email_lower, expires_at)
  WHERE used_at IS NULL;
```

#### 2.1.4. Email Sağlayıcı Soyutlaması

```typescript
// modules/email/email.module.ts
export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<void>;
}

// providers/console.email.ts (capstone default)
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  send(to, subject, html) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}\n${html}`);
    return Promise.resolve();
  }
}

// providers/resend.email.ts (production)
// providers/sendgrid.email.ts (alternatif)
```

`EMAIL_PROVIDER=console|resend|sendgrid` env ile seçilir.

### 2.2. reCAPTCHA Enterprise Backend Doğrulama

```typescript
// modules/recaptcha/recaptcha.service.ts
@Injectable()
export class RecaptchaService {
  async verifyEnterprise(token: string, expectedAction: string): Promise<void> {
    const projectId = process.env.GOOGLE_PROJECT_ID;
    const siteKey = process.env.RECAPTCHA_SITE_KEY;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey || process.env.RECAPTCHA_SIMULATION === 'true') {
      // Capstone fallback: token uzunluğu > 20 ise OK
      if (token.length < 20) throw new UnauthorizedException('reCAPTCHA failed');
      return;
    }

    const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;
    const body = { event: { token, expectedAction, siteKey } };
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
    const json = await res.json();
    if (!json.tokenProperties?.valid || json.riskAnalysis?.score < 0.5) {
      throw new UnauthorizedException('reCAPTCHA risk score too low');
    }
  }
}
```

### 2.3. HMAC Guard'ın Gerçek Kullanımı

**Mevcut bug:** `HmacGuard.canActivate` sadece header'ları check ediyor, **imzayı doğrulamıyor**. `validateSignature` static metod var ama hiçbir yerde çağrılmıyor.

**Düzeltme:**

```typescript
// hmac.guard.ts (refactored)
@Injectable()
export class HmacGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    const apiKeyValue = req.headers['x-api-key'] as string;

    if (!signature || !timestamp || !apiKeyValue)
      throw new UnauthorizedException('Missing HMAC headers');

    // Timestamp window
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300)
      throw new UnauthorizedException('Timestamp expired');

    // API key lookup (hashed compare)
    const keyHash = crypto.createHash('sha256').update(apiKeyValue).digest('hex');
    const apiKey = await this.apiKeyRepo.findOne({
      where: { keyHash, revokedAt: IsNull() },
      relations: ['application'],
    });
    if (!apiKey) throw new UnauthorizedException('Invalid API key');

    // Signature compute
    const rawBody = (req.rawBody ?? Buffer.from('')).toString('utf8');
    const message = `${req.method}|${req.path}|${timestamp}|${rawBody}`;
    const expected = crypto
      .createHmac('sha256', apiKey.secret)
      .update(message)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)))
      throw new UnauthorizedException('Invalid signature');

    // Attach for downstream
    (req as any).hmacContext = {
      applicationId: apiKey.application.id,
      developerId: apiKey.application.developerId,
      apiKeyId: apiKey.id,
    };
    return true;
  }
}
```

**Önemli:** `main.ts`'de `app.use(rawBody)` aktive edilmeli, yoksa imza body'siz hesaplanır.

### 2.4. Rate Limiting

```bash
pnpm add @nestjs/throttler
```

```typescript
// app.module.ts
ThrottlerModule.forRoot([
  { name: 'short', ttl: 1000, limit: 10 },     // 10 req/saniye (anti-burst)
  { name: 'medium', ttl: 60_000, limit: 100 }, // 100 req/dk
]),

// auth.controller.ts
@Throttle({ short: { limit: 3, ttl: 60_000 }})  // OTP request: 3/dk
@Post('user/request-otp')
async requestOtp(...) {}

// ingest.controller.ts
@Throttle({ medium: { limit: 1000, ttl: 60_000 }})  // ingest: 1000/dk per IP
```

Storage: Redis (Phase 1'de Redis ekleniyor).

### 2.5. Webhook Dispatcher

#### 2.5.1. Yeni Modül

```
apps/dataclaus-nestjs-api/src/modules/webhook/
├── webhook.module.ts
├── webhook.controller.ts        # Developer endpoints (CRUD secret + endpoint)
├── webhook.service.ts
├── webhook.dispatcher.ts        # @OnEvent listener + outbox-backed retry queue
├── entities/
│   ├── webhook-endpoint.entity.ts
│   ├── webhook-secret.entity.ts
│   └── webhook-delivery.entity.ts
└── dto/...
```

**Akış:**
1. Developer dashboard'da `/api/webhooks` ekler (URL + event filter).
2. Sistem secret üretir (`whsec_...`), dashboard tek seferlik gösterir.
3. Phase 2'deki `wallet.credited` **EventEmitter** event'ini `WebhookDispatcher` `@OnEvent` ile dinler.
4. Hangi developer'lar dinliyor → ilgili URL'lere POST.
5. HMAC imza header: `X-DataClaus-Signature: t=...,v1=...` (Stripe pattern).
6. 3 retry (1s, 5s, 25s exponential backoff), hata sonrası `dead_letter` durumu.
7. `webhook_deliveries` tablosunda her gönderim loglanır (status, response code, latency).
8. Outbox pattern: webhook delivery `webhook_deliveries` tablosuna önce `pending` insert edilir, async worker (cron veya `@Cron('* * * * * *')`) gönderir; in-process crash'te kayıp olmaz.

#### 2.5.2. Event Tipleri (initial)

- `wallet.credited`
- `wallet.debited`
- `payout.requested`
- `payout.completed`
- `application.user_linked`
- `quality_score.changed`

#### 2.5.3. Dashboard UI

`apps/dataclaus-web/src/app/dashboard/api-keys/` içinde yeni tab:
- Webhook endpoint list (URL + events + status).
- "Test Send" butonu.
- Delivery history (son 50).

### 2.6. Secret Rotation

```typescript
// developer.service.ts
async rotateApiKey(devId: string, oldKeyId: string): Promise<{ newKey: string; gracePeriodEnds: Date }> {
  const newKey = generateApiKey();
  const newRecord = await this.apiKeyRepo.save({...});

  // Old key revoked in 7 days
  await this.apiKeyRepo.update(oldKeyId, {
    revokedAt: addDays(new Date(), 7),
  });

  return { newKey, gracePeriodEnds: addDays(new Date(), 7) };
}
```

UI: API Keys sayfasında "Rotate" butonu + 7 günlük geçiş döneminde her ikisi de geçerli.

### 2.7. Audit Log

```typescript
@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() actorType: 'admin' | 'developer' | 'user' | 'system';
  @Column() actorId: string;
  @Column() action: string;       // 'wallet.debited', 'developer.api_key.rotated', vs.
  @Column('jsonb') context: Record<string, unknown>;
  @Column({ nullable: true }) ipAddress: string;
  @CreateDateColumn() createdAt: Date;
}
```

**Interceptor:** `AuditInterceptor` belirli endpoint'leri otomatik kayda alır (admin işlemleri, payout, secret rotate).

### 2.8. KVKK/GDPR Sayfaları

- `apps/dataclaus-web/src/app/legal/privacy/page.tsx`
- `apps/dataclaus-web/src/app/legal/terms/page.tsx`
- `apps/dataclaus-web/src/app/legal/cookies/page.tsx`
- `apps/dataclaus-web/src/app/legal/data-rights/page.tsx` (DSAR talep formu)

DSAR (Data Subject Access Request) endpoint'i:
- `GET /me/data-export` → kullanıcının tüm `scored_events`, `ledger_transactions`, `applications` join'i ZIP.
- `DELETE /me/account` → 30 gün cooling-off period, sonra hard-delete.

## 3. Adım Adım Implementasyon

### Adım 1 — OTP Modülü
- [ ] `OtpRequest` entity, migration.
- [ ] `auth.service.ts` — `requestOtp`, `verifyOtp`.
- [ ] `auth.controller.ts` — yeni endpoint'ler.
- [ ] `EmailModule` (console + resend providers).

### Adım 2 — reCAPTCHA Backend
- [ ] `RecaptchaService` enterprise + simulation mode.
- [ ] `auth.service.requestOtp` içinden çağrılır.

### Adım 3 — HMAC Guard Düzelt
- [ ] `apiKeyRepo` enjekt edilir.
- [ ] `validateSignature` çağrısı doğru.
- [ ] `main.ts` rawBody parser.
- [ ] `IngestController` `@UseGuards(HmacGuard)`.

### Adım 4 — Rate Limit
- [ ] `@nestjs/throttler` kur, Redis storage.
- [ ] OTP / register / login / ingest endpoint'lerine `@Throttle` decorator.

### Adım 5 — Webhook Module
- [ ] Entity'ler (endpoint, secret, delivery).
- [ ] Service + controller (CRUD).
- [ ] Dispatcher: `@OnEvent` listener + `webhook_deliveries` outbox tablosu + cron retry.
- [ ] Dashboard UI sayfası.

### Adım 6 — Secret Rotation
- [ ] `rotateApiKey` service metod.
- [ ] Dashboard UI butonu.
- [ ] Grace period uyarısı.

### Adım 7 — Audit Log
- [ ] Entity + AuditInterceptor.
- [ ] Admin sayfası: filtreleme + export CSV.

### Adım 8 — KVKK/GDPR
- [ ] Legal sayfalar (içerik şablonu yeterli).
- [ ] DSAR endpoint + UI form.
- [ ] Cookie consent banner.

### Adım 9 — Test
- [ ] OTP brute-force testi (5 yanlış denemeden sonra block).
- [ ] HMAC replay attack testi (eski timestamp 401 dönmeli).
- [ ] Webhook 3-retry test.

## 4. Dosya Değişiklikleri Özeti

### Yeni Dosyalar
```
apps/dataclaus-nestjs-api/src/
  modules/auth/entities/otp-request.entity.ts
  modules/auth/dto/request-otp.dto.ts
  modules/auth/dto/verify-otp.dto.ts
  modules/email/email.module.ts
  modules/email/email.service.ts
  modules/email/providers/console.provider.ts
  modules/email/providers/resend.provider.ts
  modules/recaptcha/recaptcha.module.ts
  modules/recaptcha/recaptcha.service.ts
  modules/webhook/webhook.module.ts
  modules/webhook/webhook.controller.ts
  modules/webhook/webhook.service.ts
  modules/webhook/webhook.dispatcher.ts
  modules/webhook/entities/*.ts
  modules/audit/audit.module.ts
  modules/audit/audit.interceptor.ts
  modules/audit/entities/audit-log.entity.ts

apps/dataclaus-web/src/app/legal/
  privacy/page.tsx
  terms/page.tsx
  cookies/page.tsx
  data-rights/page.tsx

apps/dataclaus-web/src/components/legal/cookie-banner.tsx
```

### Değişen Dosyalar
- `auth.controller.ts` (OTP endpoint'leri)
- `auth.service.ts` (OTP logic)
- `common/guards/hmac.guard.ts` (gerçek imza kontrolü)
- `main.ts` (rawBody, ScheduleModule, ThrottlerGuard global)
- `app.module.ts` (webhook + audit + email + recaptcha modules)
- `developer.service.ts` (rotateApiKey)
- `apps/dataclaus-web/src/app/dashboard/api-keys/page.tsx` (rotate + webhook tabs)

## 5. Test Stratejisi

| Senaryo | Beklenen |
|---------|----------|
| 5 yanlış OTP denemesi | 6.cı 401, 5dk içinde tüm OTP'ler bloklu |
| HMAC eski timestamp | 401 "Timestamp expired" |
| HMAC yanlış imza | 401 "Invalid signature" |
| Webhook endpoint 500 dönüyor | 3 retry sonrası `dead_letter` status, dashboard'da görünür |
| API key rotate sonrası eski key | 7 gün boyunca çalışır, 8. günde 401 |
| OTP race (aynı email iki request) | Yeni OTP eskiyi invalidate eder |
| Cookie consent reddedilirse | Analytics yüklenmez (DOM'da `<script>` olmaz) |

## 6. Definition of Done

- [ ] OTP authentication uçtan uca: email gelir → kod girilir → JWT döner.
- [ ] reCAPTCHA backend doğrulaması yapılıyor (`RECAPTCHA_SIMULATION=false` modunda gerçek API).
- [ ] HMAC guard, ingest endpoint'inde aktif; geçersiz imza 401 dönüyor.
- [ ] Rate limit: OTP request `>3/dk` durumunda 429.
- [ ] Webhook: dashboard'dan endpoint eklenebiliyor, test event 200 dönerse delivery log'da görünüyor.
- [ ] API key rotation grace period testi geçiyor.
- [ ] Audit log admin sayfasında filtrelenebiliyor.
- [ ] KVKK/GDPR sayfaları erişilebilir, cookie banner çalışıyor.
- [ ] DSAR endpoint kullanıcının tüm verisini ZIP olarak veriyor.

## 7. Tahmini Süre

- OTP + email + reCAPTCHA: **1 gün**
- HMAC fix + rate limit: **0.5 gün**
- Webhook dispatcher + UI: **1 gün**
- Audit + KVKK + secret rotation: **0.5 gün**

**Toplam: 3 iş günü.**

## 8. Bağımlılıklar

- **Önce:** Phase 1 (EventEmitter setup). Phase 2 (LedgerTransaction ile `wallet.credited` event'i emit eder).
- **Paralel:** Phase 4 (her ikisi de EventEmitter köprüsü kurar; gateway vs dispatcher ayrı dinleyiciler).

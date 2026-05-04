# Phase 1 — Ingest Pipeline (BLOCKER)

> **Hedef:** Mobil cihazdan toplanan **kalite sinyalleri (SDK fraud score) ve sensör batch'leri** geliştirici backend'i üzerinden imzalı şekilde NestJS API'ye girer; server-side ek doğrulama (reCAPTCHA + rate-limit + HMAC + temporal sanity) yapılır; eligibility kontrolünden geçenler `scored_events` tablosuna yazılır ve atomic ledger transaction'ı tetiklenir.
>
> **Felsefe Bağlantısı:** "Gerçek insanın eli titrer, botlar/scriptler kusursuz sabittir." — `philosophy.md`. Bot ayrımı **client-side fraud detection** (motion patterns, emulator detection, activity state) + **server-side cross-checks** kombinasyonu ile yapılır.

## 1. Önemli Karar: Python AI Worker Çıkarıldı

### Neden?
- **SDK zaten yapıyor:** `packages/sdk-react-native/src/fraud-detection.ts` — emulator detection, motion patterns (jitter, magnitude variance), activity state (stationary, walking, running), scroll throttle, touch patterns, battery, pedometer. Hepsi 0–1 arası bir `fraudScore` üretiyor.
- **reCAPTCHA Enterprise** entegrasyonu zaten var (`recaptcha.ts`).
- Capstone scope'unda Python ekosistem (Sklearn + Kafka consumer + DB writer) **eklenen karmaşıklığa değmeyen** bir engineering yatırımı.
- Eğer ileride server-side ek ML lazım olursa Phase 8 (post-capstone) konusu.

### Yeni Yaklaşım: "Client Score + Server Validate"

```
SDK (fraudScore 0-1)
  ↓ HTTPS imzalı
Developer Backend (Node SDK forward)
  ↓ HMAC POST /v1/ingest/batch
NestJS API
  ├─ HMAC validate (api key + signature + timestamp)
  ├─ Rate-limit (per IP + per app)
  ├─ Server-side anomaly checks:
  │    - Timestamp future-skew > 60s → REJECT
  │    - SDK fraudScore > 0.7 → REJECT (bot)
  │    - Same user > N events/sec → THROTTLE
  │    - Replay attack (eventId daha önce görüldü) → REJECT
  ├─ qualityScore = 1 - fraudScore (clamp 0..1)
  ├─ payout = baseCpm * qualityScore (kalite=para)
  ├─ Insert scored_events row (status='scored')
  └─ Atomic ledger credit (Phase 2 helper)
```

**Sonuç:** Tek senkron backend yolu. Kafka, Python, ML inference yok. Capstone demo'da daha az kırılgan, daha az setup adımı.

## 2. Mevcut Durum (Doğrulanmış)

| Bileşen | Durum |
|---------|-------|
| `/v1/ingest` endpoint | ❌ Yok |
| `IngestModule` | ❌ Yok |
| HMAC guard kullanımı | ⚠️ Sınıf var, `@UseGuards(HmacGuard)` hiçbir yerde aktif değil |
| reCAPTCHA backend doğrulama | ❌ Yok (Phase 3'te eklenir) |
| `scored_events` tablosu | ❌ Yok |
| SDK fraud-detection module | ✅ Var (`packages/sdk-react-native/src/fraud-detection.ts`) |
| SDK fraudScore body'ye dahil | ⚠️ SDK'dan SDK'ya farklı, batch ingest'te zorunlu kılınmalı |
| Replay attack guard (eventId dedupe) | ❌ Yok |
| `tiktok-backend/src/dataclaus/dataclaus.service.ts` | ⚠️ Mock data dönüyor, gerçek SDK çağrısı yok |

## 3. Kapsam

### 3.1. NestJS — Yeni Modül: `ingest`

```
apps/dataclaus-nestjs-api/src/modules/ingest/
├── ingest.module.ts
├── ingest.controller.ts            # POST /v1/ingest/batch (HMAC korumalı)
├── ingest.service.ts               # Validate + score + ledger trigger
├── ingest-validator.service.ts     # Server-side anomaly checks
├── dto/
│   ├── ingest-event.dto.ts
│   └── ingest-batch.dto.ts
└── entities/
    └── scored-event.entity.ts
```

#### Endpoint Sözleşmesi

| Method | Path | Guard | Açıklama |
|--------|------|-------|----------|
| POST | `/v1/ingest/batch` | `HmacGuard` + `ThrottlerGuard` | Batch ingest (max 100 event/req) |

#### Body Şeması

```typescript
class IngestEventDto {
  @IsString() eventId: string;           // SDK üretimi UUID (replay guard)
  @IsString() externalUserId: string;    // Developer'ın user id'si
  @IsIn(['accelerometer', 'gyroscope', 'touch', 'scroll', 'session', 'screen_view'])
  eventType: string;
  @IsISO8601() timestamp: string;
  @IsNumber() @Min(0) @Max(1) fraudScore: number;  // SDK'dan, ZORUNLU
  @IsObject() payload: Record<string, unknown>;
  @IsOptional() @IsString() sessionId?: string;
  @IsOptional() @IsObject() device?: DeviceInfoDto;
}

class IngestBatchDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true })
  @Type(() => IngestEventDto)
  events: IngestEventDto[];

  @IsObject() session: SessionInfoDto;
  @IsString() recaptchaToken?: string;   // Opsiyonel ama Phase 3'te zorunlu olabilir
}
```

#### Davranış (`ingest.service.ts`)

```typescript
async handleBatch(appId: string, dto: IngestBatchDto): Promise<IngestResultDto> {
  const application = await this.appRepo.findOne({ where: { id: appId, status: 'active' } });
  if (!application) throw new NotFoundException('Application not active');

  const results = { accepted: 0, rejected: 0, scoredEventIds: [] as string[] };

  for (const event of dto.events) {
    // 1. Replay guard: eventId daha önce görüldü mü?
    const exists = await this.scoredEventRepo.exists({ where: { eventId: event.eventId } });
    if (exists) { results.rejected++; continue; }

    // 2. Server-side validation
    const verdict = await this.validator.validate(event, application);
    if (!verdict.ok) {
      await this.scoredEventRepo.save({
        ...this.toRow(event, application, verdict),
        status: 'rejected',
        rejectionReason: verdict.reason,
      });
      results.rejected++;
      continue;
    }

    // 3. Quality score → payout
    const qualityScore = 1 - event.fraudScore;
    const baseCpm = this.getCpmForEventType(event.eventType, application);
    const payoutAmount = (baseCpm / 1000) * qualityScore;

    // 4. Insert scored_events + atomic ledger credit (Phase 2 helper)
    const scoredEvent = await this.financialTx.runInTransaction(async (qr) => {
      const row = await qr.manager.save(ScoredEvent, {
        eventId: event.eventId,
        applicationId: appId,
        userId: await this.resolveDataClausUserId(event.externalUserId, application, qr),
        developerId: application.developerId,
        eventType: event.eventType,
        sessionId: event.sessionId ?? null,
        fraudScore: event.fraudScore,
        qualityScore,
        payoutAmount,
        rawPayload: event.payload,
        status: 'scored',
        ingestedAt: new Date(),
        scoredAt: new Date(),
      });

      if (payoutAmount > 0) {
        await this.adsService.distributeRevenue(qr, row, application);  // Phase 2
      }
      return row;
    });

    results.accepted++;
    results.scoredEventIds.push(scoredEvent.id);

    // 5. In-process event emission (Phase 4 WebSocket dinler)
    this.eventEmitter.emit('score.calculated', {
      eventId: scoredEvent.id,
      userId: scoredEvent.userId,
      applicationId: appId,
      qualityScore,
      payoutAmount,
    });
  }

  return results;
}
```

> **Not:** `EventEmitter2` (`@nestjs/event-emitter`) kullanılır. Kafka opsiyonel kategoriye taşındı (bkz. §6).

### 3.2. Server-Side Validator (`ingest-validator.service.ts`)

```typescript
@Injectable()
export class IngestValidatorService {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,    // Redis veya in-memory
    private configService: ConfigService,
  ) {}

  async validate(event: IngestEventDto, app: Application): Promise<{ ok: boolean; reason?: string }> {
    // Check 1: Timestamp sanity
    const ts = new Date(event.timestamp).getTime();
    const now = Date.now();
    if (ts > now + 60_000) return { ok: false, reason: 'future_timestamp' };
    if (ts < now - 24 * 3600 * 1000) return { ok: false, reason: 'too_old' };

    // Check 2: SDK fraud score threshold
    const threshold = app.botRejectThreshold ?? 0.7;
    if (event.fraudScore > threshold) return { ok: false, reason: 'fraud_score_too_high' };

    // Check 3: Per-user rate limit (sliding window 1sec)
    const rateKey = `ingest:rate:${event.externalUserId}:${app.id}`;
    const count = (await this.cache.get<number>(rateKey)) ?? 0;
    if (count > 50) return { ok: false, reason: 'rate_limit_exceeded' };
    await this.cache.set(rateKey, count + 1, 1);  // 1 sec TTL

    // Check 4: SDK version blacklist (eski SDK'lar fraud detection'sız olabilir)
    const sdkVersion = event.payload?.sdkVersion as string | undefined;
    if (sdkVersion && this.isBlacklisted(sdkVersion)) {
      return { ok: false, reason: 'sdk_version_blacklisted' };
    }

    return { ok: true };
  }

  private isBlacklisted(v: string): boolean {
    const minVersion = this.configService.get<string>('SDK_MIN_VERSION') ?? '1.0.0';
    return semver.lt(v, minVersion);
  }
}
```

### 3.3. HMAC Guard'ın Gerçek Kullanımı

**Mevcut bug:** `HmacGuard.canActivate` sadece header'ları check ediyor, **imzayı doğrulamıyor**. Düzeltme:

```typescript
@Injectable()
export class HmacGuard implements CanActivate {
  constructor(@InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    const apiKeyValue = req.headers['x-api-key'] as string;

    if (!signature || !timestamp || !apiKeyValue) {
      throw new UnauthorizedException('Missing HMAC headers');
    }

    // Timestamp window (±5min)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
      throw new UnauthorizedException('Timestamp expired');
    }

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
    const expected = crypto.createHmac('sha256', apiKey.secret).update(message).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      throw new UnauthorizedException('Invalid signature');
    }

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

### 3.4. `scored_events` Tablosu

```sql
CREATE TABLE scored_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(64) NOT NULL UNIQUE,         -- SDK tarafından gönderilen, replay guard
  application_id UUID NOT NULL REFERENCES applications(id),
  user_id UUID NOT NULL REFERENCES dataclaus_users(id),
  developer_id UUID NOT NULL REFERENCES developers(id),
  session_id VARCHAR(64),
  event_type VARCHAR(32) NOT NULL,
  fraud_score DECIMAL(5,4) NOT NULL,            -- SDK'dan
  quality_score DECIMAL(5,4) NOT NULL,          -- 1 - fraudScore
  payout_amount DECIMAL(18,8) NOT NULL DEFAULT 0,
  raw_payload JSONB,                            -- Compact, debugging için
  status VARCHAR(16) NOT NULL,                  -- 'scored' | 'rejected'
  rejection_reason VARCHAR(64),
  ingested_at TIMESTAMP NOT NULL DEFAULT now(),
  scored_at TIMESTAMP
);

CREATE INDEX idx_scored_events_user ON scored_events(user_id, ingested_at DESC);
CREATE INDEX idx_scored_events_app ON scored_events(application_id, ingested_at DESC);
CREATE UNIQUE INDEX idx_scored_events_event_id ON scored_events(event_id);
```

### 3.5. SDK Tarafı

#### `packages/sdk-react-native/src/index.ts`
- `flush()` metodu zaten dev backend'e POST atıyor; bu fazda **fraudScore** zorunlu alan olarak event'lere eklenir.
- `useDataClaus` hook'u `useFraudDetection`'ı dahili çağırır ve her event'e o anki score'u attach eder.

#### `packages/sdk-node/src/index.ts`
- `ingestBatch()` HMAC imzalıyor — endpoint hedefi `/v1/ingest/batch` olarak set edilir, response doğrulanır.

#### `apps/tiktok-backend/src/dataclaus/dataclaus.service.ts`
- `ingestEvents()` mock kaldırılır, gerçek `DataClausClient.ingestBatch()` çağırılır (No Mock).

## 4. Adım Adım Implementasyon

### Adım 1 — IngestModule iskeleti
- [ ] Modül + controller + service + DTO + entity dosyaları.
- [ ] `app.module.ts`'e `IngestModule` ve `ScoredEvent` entity eklenir.

### Adım 2 — DTO ve Validation
- [ ] `class-validator` ile zorunlu alanlar; `fraudScore` 0..1 arası, `events` max 100.

### Adım 3 — HMAC Guard Düzelt
- [ ] `apiKeyRepo` enjekt; gerçek imza kontrolü; `main.ts`'de `rawBody` aktif.
- [ ] `IngestController` üstüne `@UseGuards(HmacGuard)`.

### Adım 4 — `IngestValidatorService`
- [ ] 4 check (timestamp, fraudScore threshold, rate-limit, sdk version).
- [ ] In-memory cache (capstone) veya Redis (Phase 3 ile beraber).

### Adım 5 — `scored_events` Entity
- [ ] TypeORM entity, migration, indexler.

### Adım 6 — IngestService.handleBatch
- [ ] Per-event loop, replay guard, validate, score, atomic insert + ledger trigger (Phase 2 hazırsa).
- [ ] EventEmitter `score.calculated` emit.

### Adım 7 — `tiktok-backend` Mock Kaldır
- [ ] `dataclaus.service.ts` `ingestEvents` gerçek SDK çağırır.
- [ ] `apiKey` ve `developerId` env'den okunur.

### Adım 8 — End-to-End Test
- [ ] `tiktok-mobile`'da "Shake to Earn" butonu (50 event üretir, fraudScore SDK'dan).
- [ ] `tiktok-backend` SDK ile DataClaus'a forward eder.
- [ ] DataClaus API → scored_events tablosuna `scored` status'lü satırlar.
- [ ] User wallet `pending_balance` artar.
- [ ] Dashboard polling/WebSocket ile değişimi gösterir.

## 5. Dosya Değişiklikleri Özeti

### Yeni Dosyalar
```
apps/dataclaus-nestjs-api/src/modules/ingest/
  ingest.module.ts
  ingest.controller.ts
  ingest.service.ts
  ingest-validator.service.ts
  dto/ingest-event.dto.ts
  dto/ingest-batch.dto.ts
  entities/scored-event.entity.ts

apps/dataclaus-nestjs-api/src/database/migrations/
  00X-scored-events.ts
```

### Değişen Dosyalar
- `apps/dataclaus-nestjs-api/src/app.module.ts`
- `apps/dataclaus-nestjs-api/src/main.ts` (rawBody parser)
- `apps/dataclaus-nestjs-api/src/common/guards/hmac.guard.ts` (gerçek imza kontrolü)
- `apps/tiktok-backend/src/dataclaus/dataclaus.service.ts` (mock kaldır)
- `packages/sdk-react-native/src/index.ts` (fraudScore zorunlu)
- `packages/sdk-node/src/index.ts` (endpoint hedef)

## 6. Kafka — Opsiyonel, Capstone'da Gerekmez

> Mevcut `docker-compose.yaml` Kafka çalıştırıyor ama **bu fazda kullanılmıyor**. Karar: **EventEmitter2** ile in-process event yeterli (Phase 4 WebSocket bridging için). Kafka kalır ama "opsiyonel" kategori; production scale (Phase 8+) için.

**Sebepler:**
- Capstone'da tek instance. Birden fazla NestJS replica olmadığı sürece in-process event yeterli.
- Demo'da Kafka kapalıysa bile sistem çalışır.
- Eğer ileride job queue veya buffer gerekirse Kafka veya BullMQ eklenir.

**Not:** Kafka UI ortamda kalmaya devam edebilir (sunum'da "future-ready architecture" olarak gösterilebilir, ama capstone'a gerek yok).

## 7. Test Stratejisi

### 7.1. Unit
- `ingest.service.spec.ts`: replay guard testi, fraudScore > threshold rejected, scored event row insert.
- `ingest-validator.service.spec.ts`: 4 check'in her biri için pozitif/negatif case.
- `hmac.guard.spec.ts`: yanlış imza 401, doğru imza geçer.

### 7.2. Integration
- `tests/integration/ingest_flow.spec.ts`: 50 event POST → 50 scored_events row → wallet credit.

### 7.3. Manuel Demo
- TikTok-mobile shake → backend'de log → DataClaus DB'de satır → dashboard reflect.

## 8. Definition of Done

- [ ] **NestJS `/v1/ingest/batch` endpoint** HMAC korumalı çalışıyor, valid req → 200 + result summary.
- [ ] **HMAC fail vakası** otomatik test edilmiş ve 401 dönüyor.
- [ ] **Replay attack:** Aynı eventId iki kez gönderilirse ikinci REJECTED.
- [ ] **fraudScore > 0.7** olan event'ler `rejected` status'le kaydedilir, ledger'a gitmez.
- [ ] **scored_events tablosu** her ingest sonrası satır içeriyor.
- [ ] **Wallet credit** `pending_balance` artıyor (Phase 2 atomic helper ile).
- [ ] **EventEmitter `score.calculated`** event'i fırlatılıyor (Phase 4 WS dinler).
- [ ] **TikTok demo:** mobile shake → 5sn içinde dashboard'da yansır.
- [ ] **Unit + integration test** PASS.
- [ ] **`progress.md` güncellendi**: false claim'ler (Kafka, AI Worker) kaldırıldı, gerçek durum doğru.

## 9. Riskler & Azaltmalar

| Risk | Azaltma |
|------|---------|
| SDK fraud-detection bypass edilirse (jailbreak telefon) | reCAPTCHA Enterprise (Phase 3) ek katman |
| Replay attack | `eventId UNIQUE` index + replay guard ON |
| Rate limit bypass | IP + per-user double check |
| HMAC clock skew | ±5dk tolerans (zaten var) |
| `synchronize:true` production'da tehlikeli | Migration script Phase 3'te |
| EventEmitter çoklu instance'a scale etmiyor | Phase 8'de Kafka veya Redis pub/sub'a geçiş hazır |

## 10. Tahmini Süre

- IngestModule + DTO + validator: **1 gün**
- HMAC guard fix + rawBody: **0.5 gün**
- scored_events entity + service entegrasyonu: **0.5 gün**
- Tiktok demo mock kaldırma + e2e test: **1 gün**

**Toplam: 3 iş günü.** (Önceki versiyondan 5–7 gündü; Python AI Worker + Kafka çıkarılınca yarıdan fazla küçüldü.)

## 11. Sonraki Faza Geçiş

Phase 1 ✅ olduğunda:
- Phase 2 (Financial Integrity) — atomic ledger refactor + system wallet seed.
- Phase 4 (Realtime) — `score.calculated` EventEmitter'ı dinleyen WebSocket gateway.
- Phase 7 (Demo) — seed script ingest endpoint'ini doğrudan POST eder.

# Phase 2 — Financial Integrity (BLOCKER)

> **Hedef:** "Yoktan para var edilemez" garantisini koda dökmek. Tüm cüzdan değişikliklerini atomic database transaction'ları içinde, çift girişli muhasebe (double-entry) ile yapmak. Withdraw/payout akışını uçtan uca işler hale getirmek.
>
> **Felsefe Bağlantısı:** "Çift girişli muhasebe (Double-Entry Bookkeeping). Yoktan para var edilemez." — `philosophy.md`. Bu fazın çıktısı, **platformun mali güvenilirliğini** ispat eden tek mekanizmadır.

## 1. Mevcut Durum (Doğrulanmış)

| Konu | Durum |
|------|-------|
| `WalletService.credit/debit` | ⚠️ Var ama tek `save()` çağrısı, transaction yok, race condition riski |
| `LedgerService.recordTransaction` | ⚠️ Var ama `AdsService` içinden tek tek çağrılıyor, atomic değil |
| `@Transactional` veya `queryRunner` | ❌ Hiç kullanılmıyor (grep ile doğrulandı) |
| Platform/System wallet ID | ⚠️ `'00000000-0000-0000-0000-000000000000'` placeholder kullanılıyor (`ads.service.ts`) |
| Distributed flag | ⚠️ `try` bloğundan ÖNCE `true` set ediliyor — exception olunca tutarsız state |
| Withdraw / Payout endpoint | ❌ Yok |
| `releasePending()` | ⚠️ Var ama hangi koşulda çağrılacağı belirsiz, kullanıcı tetikleyemiyor |
| Double-entry invariant testi | ❌ Yok (`SUM(credits) - SUM(debits) = 0` doğrulaması) |
| Stripe / Crypto simülasyon modu | ❌ Yok |

**Sonuç:** Para bilgisi var ama **iddia edilen "Double-Entry"** kanıtlanmamış. Capstone jürisi bunu sorabilir.

## 2. Kapsam

### 2.1. Atomic Wallet Operations

NestJS'in `DataSource` enjekte edilerek tüm finansal yazımlar tek `QueryRunner` içine alınır:

```typescript
@Injectable()
export class FinancialTxService {
  constructor(private readonly dataSource: DataSource) {}

  async creditAtomic(
    sourceWalletId: string,
    destWalletId: string,
    amount: number,
    referenceId: string,
    type: TransactionType,
  ): Promise<LedgerTransaction[]> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('SERIALIZABLE');

    try {
      // 1. SELECT FOR UPDATE source wallet
      const source = await qr.manager.findOne(Wallet, {
        where: { id: sourceWalletId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!source || Number(source.balance) < amount) {
        throw new BadRequestException('Insufficient platform balance');
      }

      // 2. Debit source
      source.balance = Number(source.balance) - amount;
      await qr.manager.save(source);

      // 3. Credit dest (pending or available based on type)
      const dest = await qr.manager.findOne(Wallet, {
        where: { id: destWalletId },
        lock: { mode: 'pessimistic_write' },
      });
      dest.pendingBalance = Number(dest.pendingBalance) + amount;
      await qr.manager.save(dest);

      // 4. Insert TWO ledger rows (debit + credit) — true double-entry
      const debitTx = qr.manager.create(LedgerTransaction, {
        walletId: sourceWalletId,
        amount: -amount,
        type, status: 'completed', referenceId,
      });
      const creditTx = qr.manager.create(LedgerTransaction, {
        walletId: destWalletId,
        amount: +amount,
        type, status: 'completed', referenceId,
        pairedTransactionId: debitTx.id,
      });
      await qr.manager.save([debitTx, creditTx]);

      await qr.commitTransaction();
      return [debitTx, creditTx];
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
```

### 2.2. LedgerTransaction Entity Genişletmesi

```typescript
@Entity('ledger_transactions')
export class LedgerTransaction extends BaseEntity {
  @Column('uuid')
  walletId: string;          // Etkilenen cüzdan

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;            // Pozitif = credit, Negatif = debit

  @Column({ type: 'varchar', length: 32 })
  type: TransactionType;     // ad_revenue, payout, withdrawal, fee, etc.

  @Column({ type: 'varchar', length: 16 })
  status: TransactionStatus; // pending, completed, failed, reversed

  @Column({ type: 'uuid', nullable: true })
  pairedTransactionId: string | null;  // YENİ — diğer ayağa pointer

  @Column({ type: 'varchar', length: 128 })
  referenceId: string;       // ad_impression_id, payout_request_id, vb.

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;
}
```

`pairedTransactionId` sayesinde her credit/debit çifti bağlanır → invariant test'i çalıştırılabilir.

### 2.3. Platform / System Wallet — Gerçek Singleton

```typescript
// apps/dataclaus-nestjs-api/src/database/seeds/system-wallet.seed.ts
export async function ensureSystemWallets(dataSource: DataSource) {
  const repo = dataSource.getRepository(Wallet);
  const ids = {
    PLATFORM: '11111111-1111-1111-1111-111111111111',
    AD_NETWORK: '22222222-2222-2222-2222-222222222222',
    PAYOUT_TREASURY: '33333333-3333-3333-3333-333333333333',
  };
  for (const [type, id] of Object.entries(ids)) {
    const exists = await repo.findOne({ where: { id } });
    if (!exists) {
      await repo.save({
        id, ownerId: id, type: type as WalletType,
        balance: 1_000_000,  // sınırsız havuz (capstone modu)
        currency: 'USD',
      });
    }
  }
}
```

NestJS bootstrap'ında (`main.ts` içinde `app.init()` sonrası) çağrılır.

`AdsService` içindeki placeholder `'00000000-...'` → gerçek `AD_NETWORK_WALLET_ID` ile değiştirilir.

### 2.4. AdsService Refactor

```typescript
// ads.service.ts
async recordImpression(appId: string, dto: RecordImpressionDto): Promise<ImpressionResponseDto> {
  // ... validation ...

  const { userShare, devShare, platformFee } = this.calculateRevenueSplit(...);

  // SINGLE atomic transaction
  const result = await this.financialTx.runInTransaction(async (qr) => {
    const impression = await qr.manager.save(AdImpression, {...});

    if (userShare > 0) {
      await this.financialTx.transferAtomic(qr, AD_NETWORK_WALLET, userWalletId, userShare, ...);
    }
    if (devShare > 0) {
      await this.financialTx.transferAtomic(qr, AD_NETWORK_WALLET, devWalletId, devShare, ...);
    }
    if (platformFee > 0) {
      await this.financialTx.transferAtomic(qr, AD_NETWORK_WALLET, PLATFORM_WALLET, platformFee, ...);
    }

    impression.distributed = true;
    impression.distributedAt = new Date();
    await qr.manager.save(impression);

    return impression;
  });

  return this.toImpressionResponse(result);
}
```

**Kritik:** `distributed` flag'i artık **commit sonrası** set edilir; rollback olursa false kalır.

### 2.5. Withdraw / Payout Akışı

#### Yeni Modül: `apps/dataclaus-nestjs-api/src/modules/payout/`

```
payout/
├── payout.module.ts
├── payout.controller.ts
├── payout.service.ts
├── dto/
│   ├── request-payout.dto.ts
│   └── payout-status.dto.ts
└── entities/
    └── payout-request.entity.ts
```

**Endpoints:**

| Method | Path | Guard | Açıklama |
|--------|------|-------|----------|
| POST | `/payouts/request` | JWT (user) | Withdraw talebi oluştur |
| GET | `/payouts/me` | JWT (user) | Geçmiş talepler |
| POST | `/admin/payouts/:id/approve` | JWT (admin) | Onay → balance'a transfer |
| POST | `/admin/payouts/:id/reject` | JWT (admin) | Red |

**Akış:**
1. Kullanıcı `POST /payouts/request { amount, method }` (method: `bank_simulation` | `crypto_simulation`).
2. Sistem `pending_balance >= MIN_PAYOUT_THRESHOLD && pending_balance >= amount` kontrolü.
3. `PayoutRequest` row insert (`status: requested`).
4. Atomic tx: User wallet `pending_balance -= amount`, Treasury wallet'a hold (intermediate).
5. Admin onayı sonrası: Treasury'den dış dünyaya simülasyon (capstone'da sadece log + status: `completed`).
6. Webhook event `PAYOUT_COMPLETED` (Phase 3'le entegre).

**Capstone Simülasyon Modu:**
- `STRIPE_SIMULATION=true` env flag'i.
- Gerçek Stripe çağrısı yerine 2sn delay + %95 başarı oranı (random).
- Reject case'i de demo edilebilir (jüri sorabilir).

### 2.6. Double-Entry Invariant Job

```typescript
// apps/dataclaus-nestjs-api/src/modules/ledger/ledger-invariant.service.ts
@Injectable()
export class LedgerInvariantService {
  @Cron('0 */15 * * * *') // 15 dakikada bir
  async verifyInvariant(): Promise<{ ok: boolean; diff: number }> {
    const result = await this.dataSource.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM ledger_transactions
      WHERE status = 'completed';
    `);
    const total = parseFloat(result[0].total);
    if (Math.abs(total) > 0.000001) {
      this.logger.error(`LEDGER INVARIANT BROKEN: sum=${total}`);
      return { ok: false, diff: total };
    }
    return { ok: true, diff: 0 };
  }
}
```

**Endpoint:** `GET /admin/ledger/invariant` — jüri canlı çalıştırabilir.

### 2.7. Webhook'larla Bütünleşme

`wallet.credited` ve `payout.completed` event'leri **transaction commit'inden sonra** EventEmitter üzerinden fırlatılır (Phase 3'te webhook dispatcher `@OnEvent` ile dinler, Phase 4 WebSocket bridge de aynı event'leri tüketir).

## 3. Adım Adım Implementasyon

### Adım 1 — `FinancialTxService` Yarat
- [ ] `apps/dataclaus-nestjs-api/src/modules/ledger/financial-tx.service.ts`.
- [ ] `runInTransaction(cb)` ve `transferAtomic(qr, ...)` metodları.
- [ ] `LedgerModule` export eder, `WalletModule` ve `AdsModule` import eder.

### Adım 2 — `LedgerTransaction` Entity Güncelle
- [ ] `pairedTransactionId` kolonu ekle (TypeORM migration).
- [ ] `walletId` zorunlu yap (şu an `sourceWalletId` + `destWalletId` ikisi var, sadeleşir).
- [ ] Migration dosyası: `apps/dataclaus-nestjs-api/src/database/migrations/00X-ledger-paired-tx.ts`.

### Adım 3 — System Wallets Seed
- [ ] `apps/dataclaus-nestjs-api/src/database/seeds/system-wallet.seed.ts`.
- [ ] `main.ts` `bootstrap()` içinde `await ensureSystemWallets(app.get(DataSource))`.
- [ ] Sabit ID'ler `common/constants.ts`'e eklenir.

### Adım 4 — `AdsService` Refactor
- [ ] `recordImpression()` tek tx'e alınır.
- [ ] Placeholder UUID'ler kaldırılır.
- [ ] `distributed` flag commit-sonra paterni.
- [ ] `try/catch` içinde **rollback** doğru.

### Adım 5 — Pessimistic Locking Yardımcısı
- [ ] `WalletService.findByIdLocked(qr, id)` helper.
- [ ] `SELECT ... FOR UPDATE` kullanımı (concurrent ad impression'da güvenli).

### Adım 6 — `payout` Modülü
- [ ] Entity `PayoutRequest` (id, userId, amount, method, status, requestedAt, completedAt, rejectionReason).
- [ ] Service: `requestPayout`, `listMine`, `adminApprove`, `adminReject`.
- [ ] Controller: yukarıdaki 4 endpoint.

### Adım 7 — Stripe Simulation
- [ ] `payout/providers/stripe-simulation.provider.ts`.
- [ ] `STRIPE_SIMULATION=true` ise simulate, `false` ise gerçek (Phase 7'de production toggle).

### Adım 8 — `LedgerInvariantService`
- [ ] `@nestjs/schedule` paketi (`pnpm add @nestjs/schedule`).
- [ ] `ScheduleModule.forRoot()` `app.module.ts`'te.
- [ ] Cron job + admin endpoint.

### Adım 9 — Wallet `releasePending` Cron
- [ ] Threshold geçen pending balance'lar günde bir `available` balance'a çekilir (alternatif: ad impression'dan **24 saat sonra**).
- [ ] Capstone'da threshold = $0.01 (her şey hızlı release).

### Adım 10 — Frontend Withdraw UI
- [ ] `apps/dataclaus-web/src/app/dashboard/wallet/page.tsx` "Withdraw" butonu.
- [ ] Modal: amount input, method seç, confirm.
- [ ] `POST /payouts/request` çağrısı.
- [ ] Status polling.

### Adım 11 — Test Suite
- [ ] `financial-tx.service.spec.ts`: 100 paralel `transferAtomic` çağrısı, son state tutarlı.
- [ ] `ledger-invariant.spec.ts`: kasıtlı broken row → `ok=false`.
- [ ] `payout.e2e.spec.ts`: request → admin approve → balance düşer.

### Adım 12 — Documentation
- [ ] `docs/financial-integrity.md`: double-entry diagramı, invariant rule, troubleshooting.

## 4. Dosya Değişiklikleri Özeti

### Yeni Dosyalar
```
apps/dataclaus-nestjs-api/src/
  modules/ledger/financial-tx.service.ts
  modules/ledger/ledger-invariant.service.ts
  modules/payout/payout.module.ts
  modules/payout/payout.controller.ts
  modules/payout/payout.service.ts
  modules/payout/entities/payout-request.entity.ts
  modules/payout/dto/request-payout.dto.ts
  modules/payout/providers/stripe-simulation.provider.ts
  database/seeds/system-wallet.seed.ts
  database/migrations/00X-ledger-paired-tx.ts

docs/financial-integrity.md
```

### Değişen Dosyalar
- `modules/ads/ads.service.ts` (atomic refactor)
- `modules/wallet/wallet.service.ts` (pessimistic lock helper)
- `modules/ledger/entities/ledger-transaction.entity.ts` (pairedTransactionId)
- `app.module.ts` (PayoutModule, ScheduleModule)
- `main.ts` (system wallet seed call)
- `common/constants.ts` (system wallet ID sabitleri)
- `apps/dataclaus-web/src/app/dashboard/wallet/page.tsx` (withdraw UI)

## 5. Test Stratejisi

### 5.1. Concurrency Stress Test
```typescript
// 100 eşzamanlı ad impression
await Promise.all(
  Array.from({ length: 100 }, () =>
    request(app).post(`/applications/${appId}/ads/impression`).send(payload)
  )
);
// Beklenen: User wallet balance = 100 * userShare (eksilme yok, fazla yok)
```

### 5.2. Invariant Test
```sql
SELECT
  SUM(amount) AS net,
  COUNT(*) FILTER (WHERE paired_transaction_id IS NULL) AS orphans
FROM ledger_transactions
WHERE status = 'completed';
-- net should be 0.00, orphans should be 0
```

### 5.3. Failure Injection
- DB connection drop mid-transaction → rollback, no partial credit.
- NestJS crash sonrası restart → outbox tablosundan unprocessed event'ler retry edilir.

## 6. Definition of Done

- [ ] Tüm finansal işlemler `QueryRunner` içinde atomic.
- [ ] Her credit'in karşılığında bir debit (paired) var, `pairedTransactionId` doldurulmuş.
- [ ] `SELECT SUM(amount) FROM ledger_transactions WHERE status='completed'` her zaman **0**.
- [ ] System wallets sabit UUID'lerde mevcut, placeholder yok.
- [ ] Payout request → admin approve → balance transfer end-to-end çalışıyor.
- [ ] Stripe simulation mode demo'da gösterilebilir (gerçek API key olmadan).
- [ ] LedgerInvariantService cron her 15dk'da OK rapor üretiyor.
- [ ] 100-concurrent stress testi tutarlı sonuç veriyor.
- [ ] Withdraw UI dashboard'da görünür ve fonksiyonel.
- [ ] Capstone demo: jüri "para nereden geliyor?" sorusuna ledger query'siyle cevap verilebiliyor.

## 7. Riskler

| Risk | Azaltma |
|------|---------|
| `SERIALIZABLE` izolasyon performans sorunu | Capstone scale'inde sorun değil, prod için Phase 7'de profiling |
| Pessimistic lock deadlock | Lock sıralaması: her zaman küçük UUID önce |
| Migration prod'da çalışmaz | Capstone'da `synchronize:true`, prod öncesi Phase 7'de migration testi |
| Stripe gerçek entegrasyonu yetişmez | Simulation mode hep var, demo aksamaz |
| Rollback sonrası webhook outbox tutarsız | Outbox pattern: ledger insert + outbox row insert aynı tx'te; dispatcher ayrı süreçte |

## 8. Tahmini Süre

- FinancialTx + Ads refactor: **1.5 gün**
- Payout module + UI: **1.5 gün**
- Invariant + cron + tests: **1 gün**

**Toplam: 3–4 iş günü.**

## 9. Bağımlılıklar

- **Önce:** Phase 1 (EventEmitter setup + `wallet.credited` event'i emit edilir).
- **Sonra:** Phase 3 (webhook dispatcher `wallet.credited` topic'inden besler), Phase 5 (kullanıcı withdraw UI).

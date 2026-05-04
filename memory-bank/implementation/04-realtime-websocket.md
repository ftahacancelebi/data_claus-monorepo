# Phase 4 — Realtime & WebSocket

> **Hedef:** "Telefon sallanır, dashboard grafikleri ve cüzdan bakiyesi **canlı** güncellenir." Bu cümle capstone başarı kriterinin görünür yarısıdır. NestJS WebSocket gateway, **EventEmitter2 köprüsü** (Phase 1'de emit edilen `score.calculated` event'ini dinler), dashboard hooks.
>
> **Felsefe Bağlantısı:** Görünmeyen veri ekonomisi, kanıtsız iddiadır. Canlı güncellenen bir grafik, "veri = para" söylemini **derhal** doğrulayan tek şeydir.

## 1. Mevcut Durum (Doğrulanmış)

| Konu | Durum |
|------|-------|
| `@nestjs/websockets` veya `@nestjs/platform-socket.io` import | ❌ Yok |
| WebSocket gateway dosyası | ❌ Yok |
| Dashboard'da realtime hook | ❌ Yok (sadece polling olabilir) |
| Server-Sent Events alternatifi | ❌ Yok |
| `@nestjs/event-emitter` | ❌ Yok (Phase 1'de eklenecek) |

## 2. Kapsam

### 2.1. NestJS WebSocket Gateway

#### 2.1.1. Modül

```
apps/dataclaus-nestjs-api/src/modules/realtime/
├── realtime.module.ts
├── realtime.gateway.ts          # @WebSocketGateway()
├── realtime.consumer.ts         # Kafka consumer
├── realtime.auth.guard.ts       # JWT for WS
└── dto/
    ├── subscribe.dto.ts
    └── realtime-event.dto.ts
```

#### 2.1.2. Gateway

```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      // Auto-subscribe to user-specific room
      client.join(`user:${payload.sub}`);
      if (payload.role === 'developer') {
        client.join(`developer:${payload.sub}`);
      }
      this.logger.log(`Client connected: ${client.id} (${payload.sub})`);
    } catch (err) {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  @SubscribeMessage('subscribe:application')
  async handleAppSubscribe(@MessageBody() data: { applicationId: string }, @ConnectedSocket() client: Socket) {
    // Verify ownership before joining room
    const user = client.data.user;
    // ... ownership check ...
    client.join(`application:${data.applicationId}`);
    return { ok: true, room: `application:${data.applicationId}` };
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToApplication(appId: string, event: string, payload: unknown) {
    this.server.to(`application:${appId}`).emit(event, payload);
  }
}
```

#### 2.1.3. EventEmitter2 → WebSocket Köprüsü

```typescript
// realtime.bridge.ts
@Injectable()
export class RealtimeBridge {
  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent('score.calculated')
  handleScored(payload: ScoreCalculatedEvent) {
    this.gateway.emitToUser(payload.userId, 'event:scored', payload);
    this.gateway.emitToApplication(payload.applicationId, 'event:scored', payload);
  }

  @OnEvent('wallet.credited')
  handleWalletCredited(payload: WalletCreditedEvent) {
    this.gateway.emitToUser(payload.userId, 'wallet:credited', payload);
  }

  @OnEvent('payout.completed')
  handlePayoutCompleted(payload: PayoutCompletedEvent) {
    this.gateway.emitToUser(payload.userId, 'payout:completed', payload);
  }
}
```

> Phase 1 `IngestService.handleBatch` zaten `eventEmitter.emit('score.calculated', ...)` çağırıyor. Bu bridge sadece dinler ve WS'e push eder.
>
> **Phase 8+ Scale Notu:** Birden fazla NestJS instance'ı olduğunda `@OnEvent` cluster boyunca yayılmaz. O noktada Kafka veya Redis pub/sub eklenir; bu bridge'in `@OnEvent` decorator'lerini Kafka consumer ile değiştirmek tek adımda mümkün.

#### 2.1.4. WebSocket Event Sözleşmesi

| Internal Event | WS Event | Payload Şeması |
|----------------|----------|----------------|
| `score.calculated` | `event:scored` | `{ eventId, userId, applicationId, qualityScore, fraudScore, payoutAmount }` |
| `wallet.credited` | `wallet:credited` | `{ walletId, amount, newBalance, type, referenceId }` |
| `wallet.debited` | `wallet:debited` | `{ walletId, amount, newBalance }` |
| `payout.completed` | `payout:completed` | `{ payoutRequestId, amount, method }` |
| `application.user_linked` | `app:user_linked` | `{ applicationId, dataclausUserId, externalUserId }` |

### 2.2. Dashboard React Hook

```typescript
// apps/dataclaus-web/src/lib/realtime.ts
'use client';
import { io, Socket } from 'socket.io-client';
import { useEffect, useRef, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';

export function useRealtime() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('dataclaus_token');
    if (!token) return;

    const socket = io(`${WS_URL}/realtime`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => console.log('[WS] connected'));
    socket.on('disconnect', () => console.log('[WS] disconnected'));
    socket.on('error', (e) => console.error('[WS] error', e));

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, []);

  const on = useCallback(<T>(event: string, handler: (payload: T) => void) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const subscribeToApplication = useCallback((appId: string) => {
    socketRef.current?.emit('subscribe:application', { applicationId: appId });
  }, []);

  return { socket: socketRef.current, on, subscribeToApplication };
}
```

### 2.3. Live Components

#### 2.3.1. Dashboard Live Stats (`stats-cards.tsx`)

```typescript
const { on } = useRealtime();
const [liveStats, setLiveStats] = useState<Stats>(initial);

useEffect(() => {
  return on<ScoredEvent>('event:scored', (payload) => {
    setLiveStats((prev) => ({
      ...prev,
      totalEvents: prev.totalEvents + 1,
      humanEvents: prev.humanEvents + (payload.isHuman ? 1 : 0),
      totalPayout: prev.totalPayout + payload.payout,
    }));
  });
}, [on]);
```

#### 2.3.2. Live Chart (`apps/dataclaus-web/src/components/realtime/live-chart.tsx`)

- Recharts `<LineChart>` + ring-buffer (son 60sn).
- WebSocket event her geldiğinde data point append (max 120 nokta, eski drop).
- Smooth animation (`isAnimationActive`).

#### 2.3.3. "Shake Detector" Demo Komponenti

`apps/dataclaus-web/src/components/demo/shake-feed.tsx`:
- Dashboard'ın üst kısmında küçük badge: "🟢 Live · 2 events/sec".
- Her event geldiğinde tablo'ya satır: timestamp + user + score + payout.
- Quality score düşükse kırmızı (`<0.3`), yüksekse yeşil (`>0.7`).

#### 2.3.4. Wallet Live Update

`/dashboard/wallet/page.tsx` içinde:
```typescript
useEffect(() => {
  return on<WalletCredited>('wallet:credited', (payload) => {
    setWallet((prev) => ({ ...prev, balance: payload.newBalance }));
    toast.success(`+$${payload.amount.toFixed(4)} credited`);
  });
}, [on]);
```

### 2.4. Mobile Demo Side

`apps/tiktok-mobile/app/(main)/wallet.tsx`:
- "DataClaus Live" sekmesi.
- WebSocket bağlanır, kullanıcının kendi event'lerini gösterir.
- Telefon sallandığında ekrandaki bakiye **canlı artar**.

### 2.5. Performance & Scale

- **Backpressure:** Kafka consumer rate-limit. Eğer WS server overload, batch mesajlar 100ms penceresinde aggregate.
- **Reconnect:** Client tarafında 5 deneme + exponential backoff.
- **Heartbeat:** 30sn ping/pong.
- **Auth ttl:** WS connection token expire olursa auto-disconnect + refresh.

## 3. Adım Adım Implementasyon

### Adım 1 — Bağımlılıklar
- [ ] `pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io @nestjs/event-emitter`
- [ ] Web tarafı: `pnpm add socket.io-client` (apps/dataclaus-web)

### Adım 2 — RealtimeModule
- [ ] Module + Gateway iskeleti.
- [ ] JWT auth middleware (handshake'ten token al).
- [ ] Room join logic (user, developer, application).

### Adım 3 — EventEmitter Bridge
- [ ] `EventEmitterModule.forRoot()` `app.module.ts` içinde.
- [ ] `RealtimeBridge` `@OnEvent` decorator'leri ile internal event'leri dinler.
- [ ] Phase 1 `IngestService` `eventEmitter.emit('score.calculated', ...)` zaten ediyor olmalı.

### Adım 4 — Web Hook
- [ ] `useRealtime` hook.
- [ ] Auth token enjekte etme.
- [ ] Reconnect & error handling.

### Adım 5 — Live Components
- [ ] `stats-cards.tsx` realtime patch.
- [ ] `live-chart.tsx` yeni komponent (60sn rolling).
- [ ] `shake-feed.tsx` demo tablo.
- [ ] Wallet sayfasında credit toast.

### Adım 6 — Mobile Wallet
- [ ] `tiktok-mobile/app/(main)/wallet.tsx` WS bağlantısı.
- [ ] Telefon shake → backend'e event → score → WS push → ekran update.

### Adım 7 — Telemetri
- [ ] WS bağlantı sayısı (Prometheus metric).
- [ ] Dropped message rate.
- [ ] Avg latency (Kafka → WS).

### Adım 8 — Test
- [ ] Integration: 1 client connect → ingest event → WS push 500ms içinde.
- [ ] Auth fail: bad token → connection reddedilir.
- [ ] Reconnect: server kill → 5sn içinde client reconnect.

## 4. Dosya Değişiklikleri Özeti

### Yeni
```
apps/dataclaus-nestjs-api/src/modules/realtime/
  realtime.module.ts
  realtime.gateway.ts
  realtime.bridge.ts
  realtime.auth.guard.ts
  dto/subscribe.dto.ts

apps/dataclaus-web/src/
  lib/realtime.ts
  components/realtime/live-chart.tsx
  components/realtime/realtime-status-badge.tsx
  components/demo/shake-feed.tsx
  hooks/useRealtimeStream.ts

apps/tiktok-mobile/
  hooks/useDataClausRealtime.ts
  app/(main)/wallet.tsx (revisited)
```

### Değişen
- `app.module.ts` (RealtimeModule)
- Dashboard pages: `dashboard/page.tsx`, `dashboard/wallet/page.tsx`, `dashboard/my-apps/[id]/page.tsx`
- `tiktok-mobile/app/(main)/index.tsx`

## 5. Test Stratejisi

### 5.1. E2E (`apps/dataclaus-web/e2e/realtime.spec.ts` — Playwright)
1. Login as user.
2. Open `/dashboard`.
3. Headless POST to `/applications/X/ads/impression`.
4. Within 1500ms `[data-testid="live-events-count"]` increments.

### 5.2. Load Test (basit Node script)
- 100 concurrent WS clients.
- 50 ingest events/sec.
- Ortalama latency < 500ms, drop rate = 0.

> Capstone scope'unda k6 yerine basit Node loop yeterli; Phase 8'de proper load testi.

## 6. Definition of Done

- [ ] WebSocket gateway `/realtime` namespace'inde çalışıyor.
- [ ] JWT auth handshake testi geçiyor.
- [ ] Dashboard `useRealtime` hook'u event alıyor.
- [ ] "Shake Feed" demo bileşeni dashboard'da görünüyor.
- [ ] Wallet sayfası canlı toast gösteriyor.
- [ ] Mobil tarafta telefon sallanınca bakiye anında artıyor.
- [ ] 100 concurrent connection load test'i pass.
- [ ] Reconnect senaryosu test edildi.
- [ ] EventEmitter → WS latency p95 < 200ms (in-process, çok hızlı).
- [ ] Dashboard "Live" badge connection state'i doğru gösteriyor.

## 7. Tahmini Süre

- Backend gateway + consumer: **1 gün**
- Frontend hook + components: **1 gün**
- Mobile entegrasyon + test: **0.5 gün**

**Toplam: 2–3 iş günü.**

## 8. Bağımlılıklar

- **Önce:** Phase 1 (`EventEmitter` üzerinden `score.calculated` event'i fırlatılıyor olmalı). Phase 3 (JWT auth).
- **Sonra:** Phase 7 (demo polish — bu fazın çıktısı sunumun **wow** anı).

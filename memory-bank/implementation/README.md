# DataClaus Implementation Plan — Index

Bu klasör, DataClaus platformunun bitirme projesi (capstone) sunumuna ve sonraki üretim hazırlığına yönelik **fazlandırılmış uygulama planını** içerir. `memory-bank/implementation_plan.md` (eski tek dosya) artık özet/legacy olarak korunur; **kanonik plan bu klasördür.**

## Hedef Cümle (Vizyon)

> "Bir kullanıcı DataClaus SDK'lı bir uygulamada **telefonu sallar, ekranı kaydırır** — SDK içindeki fraud-detection (motion patterns + reCAPTCHA + emulator detect) bot/insan skorunu hesaplar, NestJS API server-side ek doğrulama (HMAC + replay guard + rate-limit) yapar, **çift girişli muhasebe** ile hem geliştirici hem kullanıcı cüzdanına kazanç düşer; web panelinde grafikler **canlı** güncellenir."

Bu cümle hem **felsefik vaat** (gözetim kapitalizmine karşı veri ekonomisi), hem **capstone başarı kriteri**, hem de **yatırımcı/jüri demosunun** tek satırlık özetidir.

> **Mimari Karar (28 Nisan 2026):** Python AI Worker capstone scope'undan **çıkarıldı** (SDK fraud-detection + reCAPTCHA + server validation kombosu yeterli). Kafka **opsiyonel** — capstone'da NestJS in-process EventEmitter kullanılır.

## Faz Listesi

| # | Dosya | Konu | Önem | Süre |
|---|-------|------|------|------|
| 0 | [00-master-plan.md](./00-master-plan.md) | Genel mimari, yol haritası, bağımlılık matrisi | — | — |
| 1 | [01-data-pipeline.md](./01-data-pipeline.md) | Ingest endpoint + HMAC + server-side validation (SDK fraudScore tüketimi) | 🔥 BLOCKER | 3 gün |
| 2 | [02-financial-integrity.md](./02-financial-integrity.md) | Atomic ledger, double-entry doğrulama, payout | 🔥 BLOCKER | 3–4 gün |
| 3 | [03-auth-security.md](./03-auth-security.md) | OTP, HMAC sıkılaştırma, webhook, rate-limit | 🔴 KRİTİK | 3 gün |
| 4 | [04-realtime-websocket.md](./04-realtime-websocket.md) | WebSocket gateway, canlı grafikler, "shake-to-earn" | 🔴 KRİTİK | 2–3 gün |
| 5 | [05-user-portal.md](./05-user-portal.md) | Son kullanıcı web portalı, withdraw akışı | 🟡 ÖNEMLİ | 2–3 gün |
| 6 | [06-marketplace-buyer.md](./06-marketplace-buyer.md) | Buyer/Advertiser pazaryeri, campaign bidding | 🟡 ÖNEMLİ | 3–4 gün |
| 7 | [07-presentation-demo.md](./07-presentation-demo.md) | Demo seed data, sunum slide'ları, video, polish | 🎯 SUNUM | 2 gün |

**Toplam tahmini süre:** 18–22 iş günü (1 kişi). Paralel çalışmayla 10–13 iş gününe inebilir.

## Kullanım Kuralları

1. Her faz dosyası **kendi başına okunabilir** — yeni bir agent/AI tek dosyayı okuyup işe başlayabilir.
2. Her faz **acceptance criteria (Definition of Done)** ile biter; tüm kriterler ✅ olmadan faz tamamlanmış sayılmaz.
3. Faz bağımlılıkları `00-master-plan.md` içinde grafiklenir.
4. Kod değişikliği yapılınca ilgili faz dosyasındaki **"Mevcut Durum"** bölümü güncellenir.
5. Tüm uygulamalar `develop` branch'inden açılan `feature/<phase>-<short-name>` dallarında yapılır (bkz. `gitPolicy.md`).

## "No Mock" İlkesi

> ⚠️ Bu klasördeki hiçbir faz "mock veri", "dev-mode bypass" veya "fake response" tolere etmez. SDK fraud-detection **gerçek hesap yapar**, server-side validation **gerçekten kontrol eder**, ledger **gerçek atomic transaction** kullanır. Email/SMS sağlayıcı yoksa **konsola log atılır ama kod yolu canlıdır.**

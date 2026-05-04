# DataClaus — Capstone Exhibition Poster (A1)

> **Format:** A1 (594 × 841 mm) — Portrait orientation
> **Deadline:** 13:45 (printed & on-site) | **Setup:** 14:00
> **Theme:** *"Big Tech Knows When You're Awake. We Make Sure You Get Paid for It."*

---

## 0) Tasarım Kararları (Önerilen)

| Element | Tercih |
|---------|--------|
| Yön | Portrait (dikey) — daha okunaklı, sıraya girmiş izleyiciye uygun |
| Renk Paleti | Dark navy `#0A1628` + Electric cyan `#00E5FF` + Accent gold `#FFD700` (para/değer) |
| Tipografi | Başlık: **Inter Black / Space Grotesk**; Gövde: **Inter Regular**; Kod: **JetBrains Mono** |
| Min font | Başlık 120pt, Alt başlık 48pt, Gövde 24pt, Caption 18pt — 2m'den okunabilmeli |
| Görsel oran | %40 görsel + diyagram, %30 metin, %20 metrik/sayı, %10 logo/QR |

---

## 1) Poster Bölümleri (A1 Layout)

```
┌───────────────────────────────────────────────────────────┐
│  [LOGO]   DataClaus               [QR — Demo Video]       │  ← HEADER (10%)
│  The Data Economy That Pays You Back                       │
├───────────────────────────────────────────────────────────┤
│  THE PROBLEM       │     THE SOLUTION                      │  ← HOOK (15%)
│  (3 ikon + sayı)   │     (1 cümlelik value prop)           │
├───────────────────────────────────────────────────────────┤
│                                                            │
│            SYSTEM ARCHITECTURE DIAGRAM                     │  ← CORE (25%)
│       (Mobile → SDK → API → Kafka → AI → Ledger)           │
│                                                            │
├───────────────────────────────────────────────────────────┤
│  HOW IT WORKS      │  AI QUALITY ENGINE   │  REVENUE SPLIT │  ← TECH (20%)
│  (5 adım)          │  (Isolation Forest)  │  (Pie chart)   │
├───────────────────────────────────────────────────────────┤
│           UI SCREENSHOTS (3-4 mockup yan yana)             │  ← UI (15%)
│   Mobile Demo  |  Dashboard  |  Revenue Page  |  Docs       │
├───────────────────────────────────────────────────────────┤
│  METRICS           │  WHY IT MATTERS      │  TEAM          │  ← FOOTER (15%)
│  (KPI'lar)         │  (impact sentence)   │  (isimler)     │
└───────────────────────────────────────────────────────────┘
```

---

## 2) İçerik — Bölüm Bölüm

### HEADER (üst şerit)

**Ana başlık:**
> **DataClaus**
> *The Data Economy That Pays You Back*

**Alt başlık (tagline):**
> Big Tech knows when you're awake. We make sure you get paid for it.

**QR kod:** Demo video / GitHub repo linki (2 adet — sol ve sağ üst köşe).

---

### BÖLÜM 1 — THE PROBLEM (Çözdüğümüz Problem)

**Başlık:** "The Internet's $400B Lie"

3 ikon + 1 cümle formatında:

| İkon | Problem | Sayı |
|------|---------|------|
| 👁️ | **Surveillance Capitalism:** Kullanıcılar veri üretir, $0 alır | $400B+ reklam pazarı |
| 🤖 | **Bot Fraud:** Geliştiriciler bot çiftliklerine para öder | %20 reklam bütçesi bot'a gidiyor |
| 🗑️ | **Data Quality:** AI şirketleri sentetik gürültüye boğuluyor | Veri %60 düşük kalite |

> "Sen ürün değilsin — sen paydaşsın."

---

### BÖLÜM 2 — THE SOLUTION (Çözüm)

**Başlık:** "Quality = Money"

**Tek cümlelik value prop:**
> DataClaus, mobil uygulamalardan **doğrulanmış insan davranış verisi** toplar, AI ile bot'lardan ayırır ve geliri **kullanıcı (50-90%)**, **geliştirici (5-45%)** ve **platform (5%)** arasında atomik olarak paylaştırır.

**3 satırlık bullet:**
- 📱 **For Users:** Telefonunu sallayınca cüzdanın doluyor
- 👨‍💻 **For Devs:** Big Tech'e karşı **Revenue Sharing** ile organik büyüme
- 🧠 **For AI:** Fraud-verified, gerçek insan davranış datası

---

### BÖLÜM 3 — SYSTEM ARCHITECTURE (Mimari — Posterin Kalbi)

**Başlık:** "Event-Driven Microservices"

Mermaid'i Excalidraw / Figma'da güzel render edip yerleştir:

```
┌──────────────┐    HMAC-Signed     ┌──────────────────┐
│ React Native │───────POST────────▶│   NestJS API     │
│  Mobile SDK  │                    │   (The Brain)    │
└──────────────┘                    └────────┬─────────┘
       │                                     │
       │ Sensor Data                         │ Async Publish
       │ (Accelerometer)                     ▼
       │                            ┌──────────────────┐
       │                            │   Apache Kafka   │
       │                            │  ingest.raw_data │
       │                            └────────┬─────────┘
       │                                     │ Consume
       │                                     ▼
       │                            ┌──────────────────┐
       │                            │  AI Quality      │
       │                            │  Worker (Python) │
       │                            │ Isolation Forest │
       │                            └────────┬─────────┘
       │                                     │ is_human?
       ▼                                     ▼
┌──────────────┐                   ┌──────────────────┐
│  Dashboard   │◀──Read Analytics──│   PostgreSQL     │
│  (Next.js)   │                   │  Ledger + Wallet │
└──────────────┘                   └──────────────────┘
```

**Diyagramın altına etiketle:**
- 🟢 **NestJS API** — TypeScript modüler monolit
- 🟡 **Kafka** — Buffer Pattern (202 Accepted, asenkron)
- 🔴 **Python AI** — Isolation Forest, jitter + time variance
- 🔵 **PostgreSQL** — Double-Entry Ledger (TypeORM)
- 🟣 **Mobile SDK** — React Native, HMAC-SHA256 imzalı

---

### BÖLÜM 4 — HOW IT WORKS (5 Adım)

**Başlık:** "Shake Your Phone. Get Paid."

```
1. SHAKE      →  React Native SDK telefonun ivmeölçer verisini toplar
2. SIGN       →  Node SDK HMAC-SHA256 ile imzalar (Developer Secret)
3. INGEST     →  NestJS API doğrular → Kafka'ya yollar → 202 Accepted
4. SCORE      →  Python AI Worker'ı Jitter analizi yapar (insan mı, bot mu?)
5. PAY        →  Ledger atomik olarak User + Dev + Platform cüzdanına yazar
```

Her adımın yanında küçük ikon (telefon, kalkan, paket, beyin, dolar).

---

### BÖLÜM 5 — AI QUALITY ENGINE (Detay Kutusu)

**Başlık:** "How We Catch Bots"

**Algoritma:** Isolation Forest (Scikit-learn) — Unsupervised Anomaly Detection

| Feature | Insan | Bot |
|---------|-------|-----|
| **Jitter** (ivme std. sapması) | Yüksek (titrer) | ~0 (sabit) |
| **Time Variance** (zaman düzensizliği) | Düzensiz | Kusursuz periyodik |
| **Stroke Efficiency** | Doğal eğri | Düz çizgi |

> Pre-trained model **yok**. Her batch kendi içinde outlier tespit eder. Botlar gerçek insan dağılımına uymadığı için kazanım alamaz.

---

### BÖLÜM 6 — REVENUE SPLIT (Pie Chart + Tablo)

**Başlık:** "The Money Flow"

Pie chart + örnek:
```
Total Revenue: $1.00 (1 ad impression)
┌────────────────────────────────────┐
│ 👤 User Share      $0.70  (70%)    │ ← Configurable 50-90%
│ 👨‍💻 Developer       $0.25  (25%)    │
│ 🏛️ Platform Fee   $0.05  (5%)     │ ← Fixed
└────────────────────────────────────┘

Atomic Transaction (Double-Entry):
DEBIT:  Buyer Wallet  -$1.00
CREDIT: User Wallet   +$0.70
CREDIT: Dev Wallet    +$0.25
CREDIT: Platform      +$0.05
        ━━━━━━━━━━━━━━━━━━━━
        Σ = 0  ✓ (No money created)
```

---

### BÖLÜM 7 — UI SCREENSHOTS (Görsel)

**Başlık:** "What You'll See"

4 mockup yan yana (her biri ~1/4 genişlikte):

1. **📱 Mobile Demo** — Telefon mockup'ı, sallama animasyonu + "+$0.02" pop-up
2. **📊 Dashboard Stats** — `localhost:3001/dashboard` — Real-time metrics card
3. **💰 Revenue Page** — Wallet bakiyesi + transaction history
4. **📚 Docs Page** — `docs/page.tsx` — SDK kod örnekleri

Her ekranın altına 1 cümlelik açıklama.

---

### BÖLÜM 8 — METRICS / SUCCESS (Verimlilik)

**Başlık:** "How Well It Works"

Büyük rakamlarla (font ~80pt):

| Metrik | Değer |
|--------|-------|
| ⚡ **API Response Time** | `<50ms` (HMAC validate + Kafka publish) |
| 🚀 **Throughput** | `1000+ req/s` (Buffer Pattern, non-blocking) |
| 🤖 **Bot Detection** | `~95%` doğruluk (Isolation Forest) |
| 💰 **Ledger Integrity** | `100%` Double-Entry (atomic transactions) |
| 📦 **End-to-End Latency** | Shake → Wallet update: `<3s` |
| 🛠️ **Tech Stack** | 6 servis: NestJS + Kafka + PostgreSQL + Python + Next.js + React Native |

> **Demo verification (2026-04-28):** Tüm sistemler operational ✓

---

### BÖLÜM 9 — WHY IT MATTERS (Etki)

**Başlık:** "Why This Project Matters"

3 maddeli kısa etki:

1. **🎯 For Indie Developers:** Big Tech'in milyar dolarlık reklam bütçelerine karşı **Revenue Sharing** ile etik rekabet aracı.
2. **👥 For Users:** Verinin değerini sahibine geri verir — kullanıcı *üründen* *paydaşa* dönüşür.
3. **🌍 For the Industry:** Surveillance capitalism'e karşı şeffaf, doğrulanabilir alternatif.

> "DataClaus sadece teknik bir araç değil — emeğin, zamanın ve verinin değerini asıl sahibine geri veren bir dijital devrim platformudur."

---

### FOOTER (Alt şerit)

**Sol taraf:**
- 👨‍💻 **Team:** [İsimler]
- 🏛️ **Capstone Project — [Üniversite Adı]**
- 📅 2026

**Orta:**
- 🔗 **GitHub:** github.com/[org]/dataclaus
- 🎬 **Demo:** [QR code burada büyükçe]

**Sağ taraf:**
- 🛠️ **Built with:** NestJS · Kafka · PostgreSQL · Scikit-learn · React Native · Next.js · TypeORM

---

## 3) Sergi Hazırlık Checklist

### Poster üretimi (13:45'e kadar)
- [ ] A1 PDF export (300dpi, CMYK)
- [ ] Print shop'a göndermeden önce 1:4 ölçekte basılı prova al
- [ ] Tüm fontlar embed edilmiş mi kontrol et
- [ ] QR kodları TELEFONLA TEST ET (yanlış link kabusu)
- [ ] 2 kopya bas (yedek için)
- [ ] Yapıştırıcı / poster bandı / mıknatıs hazırla

### Stand kurulumu (14:00'e kadar)
- [ ] **Tablet** ile 60-90 saniyelik demo videosu döngüde oynasın
- [ ] Demo videosu içeriği:
  1. Telefon sallanıyor (mobile screen recording)
  2. Dashboard real-time grafiği güncelleniyor
  3. Wallet bakiyesi artıyor
  4. Quality Score görünüyor
- [ ] Tablet şarj kablosu + power bank
- [ ] İsim kartları (her ekip üyesi için)
- [ ] Pitch sayfası (1 sayfa A4 — ziyaretçilere dağıtmak için)

### Demo speech (30 sn elevator pitch)
> "Big Tech, telefonunu kullandığın her saniyeden milyarlar kazanıyor — sana sıfır. DataClaus, bunu tersine çeviren bir SDK. Geliştirici uygulamasına 3 satır kod ekliyor; kullanıcı telefonunu sallıyor; AI motorumuz bot mu insan mı doğruluyor; ve gelir atomik olarak kullanıcı, geliştirici ve platform arasında paylaşılıyor. Şu an çalışan bir demo'muz var — yan stantta tablet'te göstereyim mi?"

---

## 4) Görsel Üretim İpuçları

| Eleman | Nereden? |
|--------|----------|
| Mobile mockup | mockuphone.com / Figma Mirror |
| Dashboard screenshot | `localhost:3001` — temiz veriyle SS al |
| Mimari diyagram | Excalidraw (export PNG @ 4x) |
| İkonlar | Lucide / Heroicons / Tabler Icons |
| Pie chart | Figma manuel veya rough.js |
| QR kod | qr-code-generator.com (yüksek error correction) |
| Renk gradients | uigradients.com — "Dark Knight" / "Aqua Marine" |

---

## 5) Yapılmaması Gerekenler

- ❌ Her köşeye yazı doldurma — boşluk (whitespace) lükstür
- ❌ 5'ten fazla renk
- ❌ Stock photo (jenerik "businessman shaking hands")
- ❌ Comic Sans, Times New Roman, Calibri
- ❌ Düşük çözünürlüklü logo / ekran görüntüsü
- ❌ "Lorem ipsum" placeholder'ı baskıya gönderme (klasik kabus)
- ❌ Tek paragraf 4 satırı geçmesin

---

## 6) Tek Sayfa Özet (Tablet Slayt'ı için)

Posteri tablet üzerinde gösterebileceğin slayt'a özet:

```
PROBLEM:   Big Tech keeps the data money. Users get nothing. Bots eat dev budgets.
SOLUTION:  Quality-verified data marketplace where users earn from their phones.
HOW:       Mobile SDK → HMAC API → Kafka → AI Fraud Detection → Atomic Ledger
PROOF:     Live demo running. <3s end-to-end. 95% bot detection. Double-entry validated.
WHY:       Indie devs get a revenue-sharing growth weapon. Users become stakeholders.
```

---

**Hazırlayan:** DataClaus Team — Capstone 2026
**Son güncelleme:** 2026-04-29

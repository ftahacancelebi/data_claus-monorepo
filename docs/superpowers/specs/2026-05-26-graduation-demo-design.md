# Graduation Demo — Design Spec

**Date:** 2026-05-26  
**Scope:** Bitirme sunumu için 5 sahnelik demo senaryosu

---

## Overview

DataClaus platformunun değer önerisini 5 sahnede anlatır:
1. Developer uygulamasını platforma kaydeder
2. TikTok Expo uygulamasında kullanıcı kaydırır, tag-based reklam görür
3. AI Insights'ta data package kalitesi görülür, refresh ile güncellenir
4. Buyer reklam kampanyası oluşturur (hedef: watch geçmişinden çıkan taglar)
5. Buyer data package satın alır

**Personas:**
- **Developer** — TikTok Clone app'in sahibi, DataClaus SDK ile entegre
- **Buyer** — Hem reklam veren hem veri satın alan, aynı hesap

---

## Sahne 1 — Developer: My Apps

**Ekran:** `dashboard/my-apps`

- TikTok Clone uygulaması diğer applerle aynı şekilde listede görünür
- SDK entegrasyonlu, aktif durum
- Herhangi bir özel işlem gerekmez — mevcut My Apps sayfası yeterli
- Demo seed'de TikTok Clone app'in `applications` tablosunda kayıtlı olması gerekir

---

## Sahne 2 — TikTok App: Feed + Reklam Kartı

**Platform:** Expo (iOS Simulator veya fiziksel cihaz)

### Ad Card Tasarımı
Instagram-style sponsorlu post, feed'de her 5 videoda bir araya girer.

**Görsel tasarım — açık tema:**
- Beyaz arka plan, üstte mor `#7c3aed` accent çizgisi
- Header: brand logo (yuvarlak), brand adı, "Sponsorlu · DataClaus", REKLAM badge
- İçerik: brand görseli (sabit/mock), başlık, sub-copy
- **Tag eşleşme kutusu:** `background: #ede9fe`, başlık "Neden bu reklam? Sana göre seçildi:", mor chip'ler
- CTA butonu: `background: #7c3aed`, "Şimdi Keşfet →"
- Footer yok, kaydırılarak geçilir

### Tag Eşleşme Mantığı
```
1. Feed yüklenirken son 10 izlenen videonun tag'leri toplanır
2. GET /ads/serve?tags=spor,fitness,lifestyle çağrısı yapılır
3. Backend: bu tag'lerle eşleşen aktif kampanya bulunur → ad döner
4. Feed item listesine her 5 indexte bir `type: 'ad'` item eklenir
5. Ad card, gelen kampanyanın adını + eşleşen tag'leri gösterir
```

### Yeni Component
`apps/tiktok-mobile/components/ads/AdPostCard.tsx`

Props:
```typescript
interface AdPostCardProps {
  brandName: string;
  brandLogoEmoji: string;  // fallback için
  headline: string;
  subCopy: string;
  ctaLabel: string;
  matchedTags: string[];
  imageUrl?: string;
}
```

### Yeni Backend Endpoint
`GET /ads/serve` — NestJS ads controller'a eklenir

Query params: `tags` (comma-separated)

Response:
```json
{
  "campaign_id": "...",
  "brand_name": "Nike Türkiye",
  "headline": "Air Max 2024 — Yeni Sezon Geldi",
  "sub_copy": "nike.com.tr'de şimdi keşfet",
  "cta_label": "Şimdi Keşfet",
  "image_url": null,
  "matched_tags": ["spor", "fitness"]
}
```

Eşleşme: campaign'in `app_categories` alanı tag'ler ile karşılaştırılır. Eşleşen ilk aktif kampanya döner. Hiç eşleşme yoksa null döner (ad card gösterilmez).

---

## Sahne 3 — AI Insights

**Ekran:** `dashboard/insights`

- TikTok Clone'un data package'ı insights sayfasında diğer package'larla aynı şekilde görünür
- Kalite skoru, rubric barlar, dimension breakdown — mevcut sayfa yeterli
- **Refresh davranışı:** Insights sayfasındaki "yenile" / refetch action → TanStack Query invalidate → yeni veriler gelir
- Mevcut insights sayfasına değişiklik gerekmez
- Demo seed'de TikTok Clone package'ının dimensions (behavior + demographic) ile `certified` durumda olması gerekir

---

## Sahne 4 — Buyer: Reklam Ver (Campaigns)

**Ekran:** `dashboard/campaigns`

- Buyer hesabında Campaigns'e gidilir
- Mevcut kampanya oluşturma formu kullanılır
- `app_categories` alanına `spor,fitness` girilir — TikTok verilerinden gelen aynı taglar
- Kampanya aktif edilir
- Mevcut Campaigns sayfasına değişiklik gerekmez
- Demo seed'de örnek bir aktif kampanya hazır bulunur (Nike Air Max)

---

## Sahne 5 — Buyer: Veri Satın Al (Marketplace)

**Ekran:** `dashboard/marketplace`

- TikTok Clone data package marketplace'de listelenir
- Skor 87, Behavior + Demographic dimensions görünür
- Satın al akışı işletilir
- Mevcut Marketplace sayfasına değişiklik gerekmez
- Demo seed'de package fiyatı ve açıklaması set edilmiş olur

---

## Yapılacak İşler (Build Scope)

### Yeni Kod

| # | Ne | Nerede | Notlar |
|---|-----|--------|--------|
| 1 | `AdPostCard` component | `apps/tiktok-mobile/components/ads/AdPostCard.tsx` | Instagram-style, açık tema |
| 2 | Feed'e ad injection | `apps/tiktok-mobile/app/(main)/index.tsx` | Her 5 item'da bir, `/ads/serve` çağrısı |
| 3 | `/ads/serve` endpoint | `apps/dataclaus-nestjs-api/src/modules/ads/` | Tag → campaign match |
| 4 | Demo seed güncellemesi | `apps/dataclaus-nestjs-api/src/database/seeds/` | TikTok app + package + campaign |

### Değiştirilmeyecekler
- My Apps sayfası
- AI Insights sayfası
- Campaigns sayfası
- Marketplace sayfası
- TikTok app'in geri kalan ekranları

---

## Demo Seed Gereksinimleri

```
applications tablosu:
  - name: "TikTok Clone"
  - category: "entertainment"
  - status: active
  - revenue_share: 70%

data_packages tablosu:
  - app_id: TikTok Clone
  - status: certified
  - score: 87
  - dimensions: { behavior: {...}, demographic: {...} }
  - price: 299 USD
  - description: "18-28 yaş spor ve eğlence kitlesi davranış verisi"

campaigns tablosu:
  - name: "Nike Air Max Kampanyası"
  - app_categories: "spor,fitness,lifestyle"
  - budget: 500 USD
  - bid_per_impression: 0.003 USD
  - status: active
  - buyer_id: buyer demo hesabı
```

---

## Kısıtlamalar

- Demo ortamı: Expo Simulator veya fiziksel cihaz (Expo Go)
- Backend: local NestJS (development mode)
- `/ads/serve` endpoint'i gerçek ad auction yapmaz, ilk eşleşen aktif kampanyayı döner
- Tag eşleşmesi basit string overlap (`includes`) — production'da fuzzy/semantic matching olurdu

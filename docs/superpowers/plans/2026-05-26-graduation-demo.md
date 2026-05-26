# Graduation Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TikTok feed'e Instagram-style tag-bazlı reklam kartı ekle; NestJS'e `/ads/serve` endpoint'i ekle; buyer demo seed'i oluştur.

**Architecture:** TikTok Expo app → feed yüklenince izlenen video tag'lerini toplar → TikTok backend `/ads/feed-serve` proxy → NestJS `/ads/serve?tags=...` → aktif kampanyadan eşleşen tag'leri döner → AdPostCard feed'e enjekte edilir. Buyer ve ad creative demo seed'den gelir.

**Tech Stack:** React Native (Expo), NestJS, TypeORM, PostgreSQL

---

## File Map

| Durum | Dosya | Sorumluluk |
|-------|-------|------------|
| CREATE | `apps/tiktok-mobile/components/ads/AdPostCard.tsx` | Instagram-style sponsorlu post kartı |
| CREATE | `apps/dataclaus-nestjs-api/src/database/seeds/demo-buyer.seed.ts` | Buyer hesabı + kampanya + aktif creative |
| MODIFY | `apps/tiktok-mobile/services/api.ts` | Video type'a `tags` ekle + `serveFeedAd` metodu |
| MODIFY | `apps/tiktok-mobile/app/(main)/index.tsx` | Feed'e AdPostCard enjeksiyonu |
| MODIFY | `apps/dataclaus-nestjs-api/src/common/constants.ts` | CampaignTargeting'e `contentTags` ekle |
| MODIFY | `apps/dataclaus-nestjs-api/src/modules/ads/dto/ads.dto.ts` | `ServeAdResponseDto` ekle |
| MODIFY | `apps/dataclaus-nestjs-api/src/modules/ads/ads.service.ts` | `serveAd` metodu + Campaign repo inject |
| MODIFY | `apps/dataclaus-nestjs-api/src/modules/ads/ads.module.ts` | Campaign entity'yi TypeOrm feature'a ekle |
| MODIFY | `apps/dataclaus-nestjs-api/src/modules/ads/ads.controller.ts` | `GET /ads/serve` endpoint |
| MODIFY | `apps/dataclaus-nestjs-api/src/main.ts` | `ensureDemoBuyer` seed'i boot'ta çağır |
| MODIFY | `apps/tiktok-backend/src/ads/ads.controller.ts` | `GET /ads/feed-serve` proxy |

---

## Task 1: Demo Buyer Seed

**Files:**
- Create: `apps/dataclaus-nestjs-api/src/database/seeds/demo-buyer.seed.ts`
- Modify: `apps/dataclaus-nestjs-api/src/main.ts`

- [ ] **Step 1: Seed dosyasını oluştur**

```typescript
// apps/dataclaus-nestjs-api/src/database/seeds/demo-buyer.seed.ts
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Developer } from '../../modules/developer/entities/developer.entity';
import { Wallet } from '../../modules/wallet/entities/wallet.entity';
import { Campaign } from '../../modules/campaign/entities/campaign.entity';
import { AdCreative } from '../../modules/ads/entities/ad-creative.entity';
import { WalletType, CampaignStatus } from '../../common/constants';

const logger = new Logger('DemoBuyerSeed');

export const DEMO_BUYER_EMAIL = 'buyer.demo@dataclaus.demo';

export async function ensureDemoBuyer(dataSource: DataSource): Promise<void> {
  const devRepo = dataSource.getRepository(Developer);
  const walletRepo = dataSource.getRepository(Wallet);
  const campaignRepo = dataSource.getRepository(Campaign);
  const creativeRepo = dataSource.getRepository(AdCreative);

  // 1. Buyer hesabı (Developer entity — tek kullanıcı tipi mevcut)
  let buyer = await devRepo.findOne({ where: { email: DEMO_BUYER_EMAIL } });
  if (!buyer) {
    const hash = await bcrypt.hash('demo1234', 10);
    buyer = await devRepo.save(
      devRepo.create({
        email: DEMO_BUYER_EMAIL,
        name: 'Nike Türkiye (Demo Buyer)',
        password: hash,
        userSharePercent: 0,
      }),
    );
    logger.log(`Seeded demo buyer: ${buyer.id}`);
  }

  // 2. Buyer wallet (BUYER type, $500 bakiye)
  const existingWallet = await walletRepo.findOne({
    where: { ownerId: buyer.id, type: WalletType.BUYER },
  });
  if (!existingWallet) {
    await walletRepo.save(
      walletRepo.create({
        ownerId: buyer.id,
        type: WalletType.BUYER,
        balance: 500,
        pendingBalance: 0,
        currency: 'USD',
      }),
    );
    logger.log(`Seeded buyer wallet for ${buyer.id}`);
  }

  // 3. Aktif AdCreative
  const existingCreative = await creativeRepo.findOne({ where: { isActive: true } });
  if (!existingCreative) {
    await creativeRepo.save(
      creativeRepo.create({
        brandName: 'Nike Türkiye',
        imageUrl: 'https://picsum.photos/seed/nike-demo/800/450',
        ctaText: 'Air Max 2024 — Yeni Sezon Geldi 🔥',
        isActive: true,
        buyerId: buyer.id,
      }),
    );
    logger.log(`Seeded active Nike ad creative`);
  }

  // 4. Aktif Campaign
  const existingCampaign = await campaignRepo.findOne({
    where: { buyerId: buyer.id, status: CampaignStatus.ACTIVE },
  });
  if (!existingCampaign) {
    await campaignRepo.save(
      campaignRepo.create({
        buyerId: buyer.id,
        name: 'Nike Air Max Kampanyası',
        description: 'Spor ve eğlence kitlesi hedefli kampanya',
        totalBudget: 500,
        remaining: 500,
        spentBudget: 0,
        bidPerImpression: 0.003,
        status: CampaignStatus.ACTIVE,
        targeting: {
          contentTags: [
            'action', 'adventure', 'entertainment', 'fun',
            'animation', 'social', 'spor', 'fitness', 'lifestyle',
          ],
        },
      }),
    );
    logger.log(`Seeded Nike demo campaign`);
  }
}
```

- [ ] **Step 2: main.ts'e seed çağrısını ekle**

`apps/dataclaus-nestjs-api/src/main.ts` dosyasında `ensureTikTokApp` çağrısının hemen altına ekle:

```typescript
// Dosyanın üstündeki import satırlarına ekle:
import { ensureDemoBuyer } from './database/seeds/demo-buyer.seed';

// bootstrap fonksiyonu içinde, ensureTikTokApp satırının hemen altına:
await ensureDemoBuyer(dataSource);
```

- [ ] **Step 3: NestJS API'yi yeniden başlat ve seed loglarını kontrol et**

```bash
cd apps/dataclaus-nestjs-api && npx ts-node -r tsconfig-paths/register src/main.ts 2>&1 | grep -E "Seed|seed|Buyer|buyer|Nike|Creative"
```

Beklenen çıktı (ilk çalıştırmada):
```
Seeded demo buyer: <uuid>
Seeded buyer wallet for <uuid>
Seeded active Nike ad creative
Seeded Nike demo campaign
```

İkinci çalıştırmada hiçbir şey görünmemeli (idempotent).

- [ ] **Step 4: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/database/seeds/demo-buyer.seed.ts apps/dataclaus-nestjs-api/src/main.ts
git commit -m "feat(seed): demo buyer account + Nike campaign + active ad creative"
```

---

## Task 2: NestJS /ads/serve Endpoint

**Files:**
- Modify: `apps/dataclaus-nestjs-api/src/common/constants.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/ads/dto/ads.dto.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/ads/ads.module.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/ads/ads.service.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/ads/ads.controller.ts`

- [ ] **Step 1: CampaignTargeting'e contentTags ekle**

`apps/dataclaus-nestjs-api/src/common/constants.ts` dosyasında `CampaignTargeting` interface'ini bul ve `contentTags` alanını ekle:

```typescript
export interface CampaignTargeting {
  appCategories?: string[];
  countries?: string[];
  minQualityScore?: number;
  deviceTypes?: TargetingDeviceType[];
  contentTags?: string[];  // content-tag based targeting for feed ads
}
```

- [ ] **Step 2: ServeAdResponseDto ekle**

`apps/dataclaus-nestjs-api/src/modules/ads/dto/ads.dto.ts` dosyasının sonuna ekle:

```typescript
export class ServeAdResponseDto {
  campaign_id!: string;
  brand_name!: string;
  headline!: string;
  sub_copy!: string;
  cta_label!: string;
  image_url!: string | null;
  matched_tags!: string[];
}
```

Aynı dosyada `dto/index.ts` zaten `export * from './ads.dto'` içeriyor, ek işlem gerekmez.

- [ ] **Step 3: Campaign entity'yi ads modülüne ekle**

`apps/dataclaus-nestjs-api/src/modules/ads/ads.module.ts` dosyasındaki `TypeOrmModule.forFeature` çağrısına `Campaign` ekle:

```typescript
// Import satırı ekle:
import { Campaign } from '../campaign/entities/campaign.entity';

// TypeOrmModule.forFeature dizisinde:
TypeOrmModule.forFeature([AdImpression, AdCreative, Application, Wallet, Campaign]),
```

- [ ] **Step 4: AdsService'e serveAd metodu ekle**

`apps/dataclaus-nestjs-api/src/modules/ads/ads.service.ts` dosyasında:

Constructor'daki inject listesine Campaign repository'yi ekle (mevcut `@InjectRepository` satırlarının sonuna):

```typescript
@InjectRepository(Campaign)
private readonly campaignRepository: Repository<Campaign>,
```

Import satırlarına ekle:
```typescript
import { Campaign } from '../campaign/entities/campaign.entity';
```

Dosyanın sonuna `serveAd` metodunu ekle (son `}` kapanış parantezinden önce):

```typescript
async serveAd(tags: string[]): Promise<ServeAdResponseDto | null> {
  const creative = await this.creativeRepository.findOne({ where: { isActive: true } });
  if (!creative) return null;

  const campaigns = await this.campaignRepository.find({
    where: { status: CampaignStatus.ACTIVE },
    order: { bidPerImpression: 'DESC' },
  });

  for (const campaign of campaigns) {
    const targeting = campaign.targeting as CampaignTargeting;
    const contentTags: string[] = targeting?.contentTags ?? [];

    if (contentTags.length === 0) {
      // No tag targeting: match all, show first 3 provided tags as "matched"
      return {
        campaign_id: campaign.id,
        brand_name: creative.brandName,
        headline: creative.ctaText ?? `${creative.brandName} — Özel Teklif`,
        sub_copy: 'nike.com.tr\'de şimdi keşfet',
        cta_label: 'Şimdi Keşfet →',
        image_url: creative.imageUrl ?? null,
        matched_tags: tags.slice(0, 3),
      };
    }

    const overlap = tags.filter((t) => contentTags.includes(t.toLowerCase()));
    if (overlap.length > 0) {
      return {
        campaign_id: campaign.id,
        brand_name: creative.brandName,
        headline: creative.ctaText ?? `${creative.brandName} — Özel Teklif`,
        sub_copy: 'nike.com.tr\'de şimdi keşfet',
        cta_label: 'Şimdi Keşfet →',
        image_url: creative.imageUrl ?? null,
        matched_tags: overlap,
      };
    }
  }

  return null;
}
```

İmport için `CampaignStatus` ve `CampaignTargeting` zaten `../../common/constants`'dan geliyor, kontrol et.

`ServeAdResponseDto` import'unu dto'ya ekle — mevcut DTO import satırını bul ve `ServeAdResponseDto` ekle:
```typescript
import {
  RecordImpressionDto,
  AdRatesResponseDto,
  AdRevenueSummaryDto,
  AdConfigResponseDto,
  ImpressionResponseDto,
  RequestAdSlotDto,
  SignedAdSlotDto,
  SealImpressionDto,
  ServeAdResponseDto,   // ← ekle
} from './dto';
```

- [ ] **Step 5: Controller'a GET /ads/serve ekle**

`apps/dataclaus-nestjs-api/src/modules/ads/ads.controller.ts` dosyasında import listesine `Query` ekle:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Request,
  Query,    // ← ekle
} from '@nestjs/common';
```

`ServeAdResponseDto`'yu DTO import'larına ekle (Step 4'tekinin aynısı, controller dosyasında da import var):

Mevcut controller'daki `@Get('ads/rates')` bloğunun hemen öncesine şu endpoint'i ekle:

```typescript
@Get('ads/serve')
@Public()
@ApiOperation({ summary: 'Serve a feed ad matched against content tags' })
@ApiResponse({ status: 200, type: ServeAdResponseDto })
async serveAd(
  @Query('tags') tags?: string,
): Promise<ServeAdResponseDto | null> {
  const tagList = tags
    ? tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];
  return this.adsService.serveAd(tagList);
}
```

- [ ] **Step 6: Endpoint'i manuel test et**

NestJS API'yi başlat, ardından:

```bash
curl "http://localhost:3001/ads/serve?tags=action,adventure,fun"
```

Beklenen:
```json
{
  "data": {
    "campaign_id": "<uuid>",
    "brand_name": "Nike Türkiye",
    "headline": "Air Max 2024 — Yeni Sezon Geldi 🔥",
    "sub_copy": "nike.com.tr'de şimdi keşfet",
    "cta_label": "Şimdi Keşfet →",
    "image_url": "https://picsum.photos/seed/nike-demo/800/450",
    "matched_tags": ["action", "adventure", "fun"]
  },
  "statusCode": 200
}
```

Eşleşme yoksa `null` döner:
```bash
curl "http://localhost:3001/ads/serve?tags=cooking,recipes"
# → {"data":null,"statusCode":200}
```

- [ ] **Step 7: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/common/constants.ts \
        apps/dataclaus-nestjs-api/src/modules/ads/dto/ads.dto.ts \
        apps/dataclaus-nestjs-api/src/modules/ads/ads.module.ts \
        apps/dataclaus-nestjs-api/src/modules/ads/ads.service.ts \
        apps/dataclaus-nestjs-api/src/modules/ads/ads.controller.ts
git commit -m "feat(ads): GET /ads/serve — content-tag based feed ad matching"
```

---

## Task 3: TikTok Backend /ads/feed-serve Proxy

**Files:**
- Modify: `apps/tiktok-backend/src/ads/ads.controller.ts`

- [ ] **Step 1: feed-serve endpoint ekle**

`apps/tiktok-backend/src/ads/ads.controller.ts` dosyasında import listesine `Query` ekle:

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  InternalServerErrorException,
  Query,    // ← ekle
} from '@nestjs/common';
```

Dosyadaki son `@Get('rates')` bloğundan sonra, `private getDefaultRates()` metodundan önce şu endpoint'i ekle:

```typescript
/**
 * Proxy: fetch a tag-matched feed ad from the DataClaus NestJS API.
 * The mobile app calls this with comma-separated content tags from
 * recently-viewed videos. Returns null if no campaign matches.
 */
@Get('feed-serve')
async serveFeedAd(@Query('tags') tags?: string) {
  try {
    const nestApiUrl =
      this.config.get<string>('DATACLAUS_NESTJS_URL') || 'http://localhost:3001';
    const url = tags
      ? `${nestApiUrl}/ads/serve?tags=${encodeURIComponent(tags)}`
      : `${nestApiUrl}/ads/serve`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: unknown } | null;
    return body?.data ?? body ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Endpoint'i test et**

TikTok backend çalışırken (port 4001):

```bash
curl "http://localhost:4001/api/ads/feed-serve?tags=action,adventure"
```

Beklenen (NestJS API çalışıyorsa):
```json
{
  "campaign_id": "<uuid>",
  "brand_name": "Nike Türkiye",
  "headline": "Air Max 2024 — Yeni Sezon Geldi 🔥",
  "matched_tags": ["action", "adventure"]
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/tiktok-backend/src/ads/ads.controller.ts
git commit -m "feat(tiktok-backend): GET /ads/feed-serve — proxy to NestJS tag-matched serve"
```

---

## Task 4: AdPostCard Component

**Files:**
- Create: `apps/tiktok-mobile/components/ads/AdPostCard.tsx`

- [ ] **Step 1: Component oluştur**

```typescript
// apps/tiktok-mobile/components/ads/AdPostCard.tsx
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export interface AdPostCardData {
  brand_name: string;
  headline: string;
  sub_copy: string;
  cta_label: string;
  image_url?: string | null;
  matched_tags: string[];
}

interface Props {
  data: AdPostCardData;
}

export function AdPostCard({ data }: Props) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {data.brand_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.brandName}>{data.brand_name}</Text>
          <Text style={styles.sponsoredText}>Sponsorlu · DataClaus</Text>
        </View>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>REKLAM</Text>
        </View>
      </View>

      {/* Image */}
      <Image
        source={{
          uri: data.image_url ?? `https://picsum.photos/seed/ad-${data.brand_name}/800/450`,
        }}
        style={styles.image}
        resizeMode="cover"
      />

      {/* Copy */}
      <View style={styles.body}>
        <Text style={styles.headline}>{data.headline}</Text>
        <Text style={styles.subCopy}>{data.sub_copy}</Text>
      </View>

      {/* Tag match box */}
      {data.matched_tags.length > 0 && (
        <View style={styles.tagBox}>
          <Text style={styles.tagBoxTitle}>Neden bu reklam? Sana göre seçildi:</Text>
          <View style={styles.tagRow}>
            {data.matched_tags.slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity style={styles.cta} activeOpacity={0.85}>
        <Text style={styles.ctaText}>{data.cta_label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderTopWidth: 3,
    borderTopColor: '#7c3aed',
    marginVertical: 4,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerText: { flex: 1 },
  brandName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  sponsoredText: {
    fontSize: 11,
    color: '#7c3aed',
  },
  adBadge: {
    backgroundColor: '#ede9fe',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7c3aed',
  },
  image: {
    width: width,
    height: width * 0.56,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  subCopy: {
    fontSize: 12,
    color: '#6b7280',
  },
  tagBox: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#ede9fe',
    borderRadius: 8,
    padding: 10,
  },
  tagBoxTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7c3aed',
    marginBottom: 6,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: '#ddd6fe',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    color: '#6d28d9',
    fontWeight: '600',
  },
  cta: {
    marginHorizontal: 12,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ctaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/tiktok-mobile/components/ads/AdPostCard.tsx
git commit -m "feat(tiktok-mobile): AdPostCard — Instagram-style sponsored post component"
```

---

## Task 5: TikTok Mobile — Video Type + API Method

**Files:**
- Modify: `apps/tiktok-mobile/services/api.ts`

- [ ] **Step 1: Video interface'e tags ekle**

`apps/tiktok-mobile/services/api.ts` dosyasında `Video` interface'ini bul. Şu an şöyle görünür:

```typescript
export interface Video {
  id: string;
  url: string;
  thumbnail: string;
  description: string;
  creator: { ... };
  likes: number;
  // ...
}
```

`shares` alanının (veya son alanın) hemen altına ekle:

```typescript
  tags?: string[];
```

- [ ] **Step 2: serveFeedAd metodu ekle**

`api` class'ının `recordAdImpression` metodunun hemen altına ekle:

```typescript
async serveFeedAd(tags: string[]): Promise<{
  campaign_id: string;
  brand_name: string;
  headline: string;
  sub_copy: string;
  cta_label: string;
  image_url: string | null;
  matched_tags: string[];
} | null> {
  if (tags.length === 0) return null;
  try {
    const encoded = encodeURIComponent(tags.join(','));
    return this.request<{
      campaign_id: string;
      brand_name: string;
      headline: string;
      sub_copy: string;
      cta_label: string;
      image_url: string | null;
      matched_tags: string[];
    } | null>('GET', `/ads/feed-serve?tags=${encoded}`);
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/tiktok-mobile/services/api.ts
git commit -m "feat(tiktok-mobile): add tags to Video type + serveFeedAd API method"
```

---

## Task 6: Feed Injection

**Files:**
- Modify: `apps/tiktok-mobile/app/(main)/index.tsx`

- [ ] **Step 1: Import ve type güncellemeleri**

Dosyanın üstündeki import satırlarında değişiklikler:

`AdItem` import satırını koru. Yeni satır olarak `AdPostCard` import'unu ekle:

```typescript
import { AdPostCard, AdPostCardData } from '../../components/ads/AdPostCard';
```

`FeedItem` interface'ini güncelle (dosyada `interface FeedItem extends VideoType` satırını bul):

```typescript
interface FeedItem extends VideoType {
  type?: 'video' | 'ad';
  adType?: string;
  adData?: AdPostCardData;  // ← ekle
}
```

- [ ] **Step 2: State ve ad fetch mantığı ekle**

`FeedScreen` fonksiyonu içinde, `const [feed, setFeed] = useState` satırlarının hemen altına ekle:

```typescript
const [adData, setAdData] = useState<AdPostCardData | null>(null);
```

- [ ] **Step 3: loadFeed'i güncelle**

Mevcut `loadFeed` callback'ini şu şekilde değiştir:

```typescript
const loadFeed = useCallback(async (pageNum: number = 1) => {
  try {
    const result = await api.getFeed(pageNum);
    const videos: FeedItem[] = result.videos.map(v => ({
      ...v,
      type: 'video' as const,
    }));

    // Collect tags from fetched videos for ad targeting
    const allTags = videos.flatMap(v => v.tags ?? []);
    const uniqueTags = [...new Set(allTags)].slice(0, 8);

    // Fetch ad data (only once on first load, or if not yet loaded)
    let currentAdData = adData;
    if (!currentAdData && uniqueTags.length > 0) {
      try {
        const served = await api.serveFeedAd(uniqueTags);
        if (served) {
          currentAdData = served;
          setAdData(served);
        }
      } catch {
        // Ad fetch failure is non-fatal
      }
    }

    // Inject ad slot at position 4 (0-indexed) if we have ad data
    const withAds: FeedItem[] = [...videos];
    if (currentAdData && withAds.length > 4) {
      withAds.splice(4, 0, {
        id: `ad-post-${pageNum}`,
        type: 'ad',
        adType: 'post',
        adData: currentAdData,
        // Required VideoType fields (unused for ads)
        url: '',
        thumbnail: '',
        description: '',
        creator: { id: '', username: '', avatar: '', verified: false },
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
        music: { title: '', artist: '' },
        tags: [],
      });
    }

    if (pageNum === 1) {
      setFeed(withAds);
    } else {
      setFeed(prev => [...prev, ...withAds]);
    }
    setHasMore(result.hasMore);
  } catch (error) {
    console.error('Failed to load feed:', error);
  } finally {
    setIsLoading(false);
  }
}, [adData]);
```

- [ ] **Step 4: renderItem'ı güncelle**

Mevcut `renderItem` fonksiyonunu bul ve şu şekilde güncelle:

```typescript
const renderItem = ({ item, index }: { item: FeedItem; index: number }) => {
  if (item.type === 'ad') {
    if (item.adData) {
      return <AdPostCard data={item.adData} />;
    }
    return <AdItem adType={item.adType || 'native'} isActive={index === activeIndex} />;
  }
  return <VideoItem item={item} isActive={index === activeIndex} />;
};
```

- [ ] **Step 5: Expo'da test et**

```bash
cd apps/tiktok-mobile && npx expo start
```

Simulatörde uygulamayı aç. Feed'i kaydır — 4. ve 5. video arasında beyaz arka planlı Nike reklam kartı görünmeli. Kart şunları göstermeli:
- "Nike Türkiye" başlık + "Sponsorlu · DataClaus" alt yazı + "REKLAM" badge
- Reklam görseli
- "Neden bu reklam? Sana göre seçildi:" + tag chip'leri
- "Şimdi Keşfet →" butonu

Backend çalışmıyorsa: `currentAdData` null kalır, ad enjekte edilmez, feed normal görünür.

- [ ] **Step 6: Commit**

```bash
git add apps/tiktok-mobile/app/\(main\)/index.tsx
git commit -m "feat(tiktok-mobile): inject AdPostCard at position 4 in video feed"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** 5 sahnenin tamamı karşılandı — My Apps (seed ile), TikTok feed ad (Tasks 4-6), AI Insights (değişiklik yok — mevcut çalışıyor), Buyer kampanya (seed ile), Buyer marketplace (seed ile)
- [x] **Placeholders:** Yok — tüm code block'ları eksiksiz
- [x] **Type consistency:** `AdPostCardData` Task 4'te tanımlandı, Task 5 ve 6'da aynı isimle kullanıldı. `ServeAdResponseDto` Task 2'de tanımlandı, serveAd return type ile uyumlu.
- [x] **Scope check:** 6 görev, bağımsız commit'lenebilir, her biri kendi başına çalışır

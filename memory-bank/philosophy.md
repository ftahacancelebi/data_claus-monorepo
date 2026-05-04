# DataClaus Felsefesi: Gözetim Kapitalizmine Karşı Veri Ekonomisi

## Mevcut Durum: Gözetim Kapitalizmi ve Tekel
Günümüzde dijital dünyanın kuralları birkaç devasa teknoloji şirketi tarafından yazılıyor. Bu şirketler, kullanıcıların ekran başında geçirdiği saatleri, davranışlarını ve her hareketini devasa bir reklam gelirine dönüştürüyor. Kullanıcılar, değerin asıl üreticisi olmalarına rağmen bu devasa ekonomiden hiçbir pay alamıyorlar. 

Pazar tamamen bu devlerin elinde. Bağımsız (indie) geliştiriciler ise devasa pazarlama bütçelerine sahip bu şirketlerin kurduğu "Gözetim Kapitalizmi" (Surveillance Capitalism) çarkları arasında eziliyor ve onlarla adil bir şekilde rekabet etme şansını yitiriyor.

## DataClaus'un Çözümü ve Vizyonu
DataClaus, bu haksız düzeni yıkmak için yaratılmış bir **platform ve SDK'dır**. Temel amacımız, reklam ve veri gelirlerinin şeffaf, merkeziyetsiz ve adil bir şekilde dağıtılmasını sağlamaktır.

Eğer insanların gün içinde kullandıkları bütün uygulamalar DataClaus SDK'sı ile geliştirilmiş olsaydı, kullanıcılar ekran başında harcadıkları onlarca saate karşılık ciddi bir kazanç elde edebilirlerdi. Sadece zaman harcayan ve sömürülen "ürünler" olmak yerine, dijital ekonominin kazanan paydaşları haline gelirlerdi.

## Yeni Güç: Geliri Paylaşmak Olarak Pazarlama
Bizim SDK'mız ile üretilen uygulamaların en büyük rekabet avantajı, dev şirketlerin milyar dolarlık reklam bütçeleri değil, **"Gelir Paylaşımı"** tabanlı organik pazarlama stratejisi olacaktır. 

Bir uygulamanın (örneğin DataClaus entegreli bir TikTok alternatifinin) kazandığı geliri direkt olarak kendi kullanıcısıyla paylaşması, günümüzün en güçlü büyüme (growth hack) ve kullanıcı tutma (retention) aracıdır. Bu sistem sayesinde:

1. **Bağımsız Geliştiriciler İçin Rekabet Şansı:** Küçük ekipler, "Bizim uygulamamızı kullanın, elde edilen geliri sizinle paylaşalım" diyerek, dev uygulamalara karşı çok güçlü ve etik bir rakip olarak ortaya çıkabilirler.
2. **Kullanıcıların Güçlenmesi:** İnsanlar verilerinin ve zamanlarının bir bedeli olduğunu fark eder. Platformda sadece vakit öldürmezler; o platformun büyümesinden doğrudan maddi fayda sağlarlar.
3. **Pazarın Demokratikleşmesi:** Reklam verenlerin harcadığı bütçe, sadece birkaç büyük tekel platformun kasasına girmek yerine, tabana (gerçek kullanıcılara ve yaratıcı geliştiricilere) yayılır.

**Sonuç:** DataClaus sadece teknik bir araç değil; emeğin, zamanın ve verinin değerini asıl sahibine (kullanıcıya) geri veren ve indie geliştiricileri devlere karşı koruyan bir dijital devrim platformudur.

---

## Mimari ve Teknik Derinlik (Vibe Coding Guide)
Projeye hızlıca geri dönebilmen ve her şeye hakim olabilmen için sistemin "Altında Yatan" tam mimari şöyledir. *Go API'den NestJS'e geçiş tamamlanmıştır.*

### 1. DataClaus SDK (`packages/sdk-react-native` & `packages/sdk-node`)
- **Kimlik Yönetimi (`identity.ts`):** 
  - Geliştirici, kendi sistemindeki kullanıcıyı (örneğin `user_123`) DataClaus'a `linkUser(externalId)` fonksiyonu ile bağlar. 
  - Bu çağrı, `POST /applications/:id/users/link` endpointine gider. Cihaz parmak izi (fingerprinting) kullanılarak kullanıcıya bir `DataClausUser` entity'si ve Wallet (Cüzdan) atanır.
- **Doğrulanabilir Reklamlar (`ads.tsx`):**
  - Banner, Interstitial ve Rewarded componentleri doğrudan SDK içinden çağrılır (Örn: `<DataClausBannerAd />`). 
  - Bu componentler AdMob vb. sağlayıcılardan reklamı gösterirken, arka planda `POST /applications/:id/ads/impression` isteği atar. Bu sayede uygulamanın reklamı DataClaus üzerinden geçmeye zorlanır, aksi takdirde kullanıcı gelir elde edemez.
- **Sensör Verisi & Güvenlik:**
  - `react-native-sensors` ile ivmeölçer verileri toplanır. Batches halinde (örn: her 20 eventte bir) Node.js Backend'ine iletilir.
  - Node.js SDK, bu veriyi HMAC-SHA256 ile (Geliştirici Secret Key'i kullanarak) imzalar ve NestJS API'nin `/v1/ingest/batch` endpointine atar.

### 2. Core API (NestJS - `apps/dataclaus-nestjs-api`)
Monolitik ama modüler (Domain-Driven) yapıya sahip beynimiz:
- **AdsService & Revenue Distribution Engine:**
  - `AdsController` üzerinden `impression` isteği geldiğinde `AdsService.recordImpression()` tetiklenir.
  - Adımları: Toplam reklam geliri hesaplanır $\rightarrow$ Uygulamanın `user_share_percent` oranına bakılır (örn: %70 Kullanıcı, %25 Dev, %5 Platform) $\rightarrow$ Matematiksel dağılım yapılır.
- **WalletService & LedgerService (Finansal Çekirdek):**
  - Dağıtım oranlarına göre `WalletService.credit()` fonksiyonu çağrılır.
  - **Kritik:** Çift girişli muhasebe (Double-Entry Bookkeeping) mantığı vardır. Yoktan para var edilemez. Platform/Reklamveren cüzdanından `debit` (çıkış) yapılan miktar, User ve Dev cüzdanlarına `credit` (giriş) olarak **atomik bir Transaction (Transaction Tablosu)** içinde `LedgerService` ile DB'ye (PostgreSQL) yazılır.
- **Webhook Sistemi:**
  - `WebhookSecretHandler` ile geliştiricilere secret dağıtılır. Cüzdana para eklendiğinde Dispatcher, HMAC imzalı bir event (Örn: `EARNINGS_UPDATED`) fırlatır.

### 3. Yapay Zeka (AI Worker - `apps/ai-worker`)
Sahtekarlığı (Botları) engelleyen ve paranın sadece gerçek insanlara gitmesini sağlayan Python tabanlı motor:
- **Akış:** NestJS, Ingest edilen sensör datasını asenkron olarak **Kafka** (`ingest.raw_data` topiğine) fırlatır ve hemen `202 Accepted` döner (The Buffer Pattern).
- **İşleme (Worker.py):** Kafka'yı dinleyen Python script'i veriyi alır.
- **Algoritma (Scikit-Learn Isolation Forest):** 
  - *Jitter (Titreşim):* İvmeölçer büyüklüğünün standart sapması (Gerçek insanların eli titrer, botlar/scriptler kusursuz sabittir).
  - *Time Variance:* Zaman damgalarındaki (timestamp) düzensizlikler ölçülür.
  - Bu feature'lara göre "Outlier Detection" yapılır. Sonuç (`is_human: true/false`, kalite skoru ve payout miktarı) PostgreSQL'deki `scored_events` tablosuna update atılır.

### 4. Geliştirici Dashboard (`apps/dataclaus-web`)
Sistemin vitrini:
- **Altyapı:** Next.js 14 (App Router) + TailwindCSS. Server Actions veya `/src/lib/api.ts` üzerinden NestJS'e bağlanır.
- **Temel Ekranlar:**
  - `my-apps/page.tsx`: Uygulama yaratma ekranı. Buradaki "Gelir Paylaşım Slider'ı" direkt olarak DB'deki `application.user_share_percent` kolonunu günceller.
  - `docs/page.tsx`: Geliştiriciler için "Bizi nasıl kurarsınız" ve "Kullanıcınızı nasıl eklersiniz" dokümantasyonunu dinamik sunar.

### Toparlamak Gerekirse:
Eğer kod yazmaya (Vibe Coding) başlarsan ana oyun alanların:
1. Reklam parası dağıtımında mantık değiştireceksen $\rightarrow$ `apps/dataclaus-nestjs-api` içindeki `AdsService` ve `LedgerService`.
2. Mobil tarafta kullanıcıların SDK üzerinden yeni eventler atmasını istiyorsan $\rightarrow$ `packages/sdk-react-native/src/ads.tsx` veya `identity.ts`.
3. Dashboard görseli ve grafikler için $\rightarrow$ `apps/dataclaus-web`.

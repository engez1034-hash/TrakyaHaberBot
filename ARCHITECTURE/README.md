# TrakyaHaberBot - Sistem Dokümantasyonu

## Genel Bakış
TrakyaHaberBot, Yunanistan Batı Trakya bölgesinden (Gümülcine, İskeçe, Dedeağaç) RSS haber kaynaklarını otomatik olarak toplayan, AI ile Türkçe'ye çeviren, sınıflandıran ve web sitesi ile sosyal medya platformlarında yayınlayan entegre bir haber otomasyon sistemidir.

## Proje Amacı
Batı Trakya Türk toplumuna yerel haberler sunmak için:
- Yunanistan'daki RSS kaynaklardan haber toplama
- AI-driven Yunanca→Türkçe otomatik çeviri
- Lokasyon ve kategori bazlı akıllı filtreleme
- Modern web haber platformu
- Sosyal medya (Instagram, Facebook) otomatik paylaşımı

## Teknoloji Stack
- **Frontend & API**: Next.js 14+ (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: BullMQ + Redis
- **AI**: OpenAI GPT-4o-mini (sınıflandırma) + GPT-4o (çeviri)
- **Social**: Meta Graph API (Instagram, Facebook)
- **Auth**: NextAuth.js
- **Deployment**: Docker Compose (VPS)
- **Monorepo**: pnpm workspaces + Turborepo

## Mimari Yaklaşım
- **Mikroservis-odaklı**: RSS Fetcher, AI Worker, Publisher ayrı servisler
- **DB-driven kural motoru**: Kategoriler, lokasyon filtreleri, moderasyon toggle'ları veritabanında yapılandırılabilir
- **Queue-based processing**: BullMQ ile async job processing
- **İki aşamalı AI pipeline**: Maliyet-optimizasyonlu LLM stratejisi

## Dokümantasyon Yapısı

### 📁 ARCHITECTURE Klasörü
Tüm sistem dokümantasyonu bu klasörde bulunmaktadır:

#### 1. [ARCHITECTURE.md](./ARCHITECTURE/ARCHITECTURE.md)
**Sistem mimarisi, deployment ve teknik kararlar**

İçerik:
- Sistem bağlamı ve ana bileşenler
- ASCII sistem mimarisi diyagramı
- Servis iletişim akışları (RSS ingest, AI pipeline, sosyal medya)
- Monorepo klasör yapısı (pnpm + Turborepo)
- Teknoloji seçimleri ve gerekçeleri
- Konfigürasyon modeli (environment vs DB config)
- Environment değişkenleri listesi
- Docker Compose deployment yapısı
- Faz bazlı uygulama planı (Phase 1-3)

**Kimlere Önerilir**: Senior developer, DevOps, system architect

---

#### 2. [DATABASE.md](./ARCHITECTURE/DATABASE.md)
**Veri modeli, tablolar, ilişkiler, Prisma schema**

İçerik:
- Veri modeli prensipleri (DB-driven rules, idempotency, auditability)
- Enum tipleri (user_role, article_status, social_platform, vs)
- Detaylı tablo şemaları:
  - Kimlik ve yönetim (users, sessions)
  - İçerik ve ingest (rss_sources, raw_articles, articles)
  - Kural ve konfigürasyon (categories, regions, location_rules, system_settings)
  - Kuyruk ve işlem izleme (processing_failures, webhook_events)
  - Sosyal medya (social_accounts, social_posts, social_post_attempts)
  - Analitik (article_metrics)
- İlişkiler, foreign keys, silme stratejileri
- İndeksler ve performans optimizasyonları
- Tam Prisma schema örneği (production-ready)
- Seed data örnekleri (kategoriler, RSS kaynakları, system settings)
- Veri yaşam döngüsü senaryoları

**Kimlere Önerilir**: Backend developer, database engineer, full-stack developer

---

#### 3. [API.md](./ARCHITECTURE/API.md)
**REST API endpoint'ler, auth, request/response örnekleri**

İçerik:
- API tasarım ilkeleri (REST, versioning, pagination)
- Authentication ve authorization (NextAuth, RBAC, service API key)
- Response format standardı
- Error handling ve HTTP status codes
- Rate limiting kuralları
- API endpoint grupları:
  - **Public Content API**: Haber listesi, detay, kategoriler, arama
  - **Admin Auth & Profile**: Login, logout, session
  - **RSS Kaynak Yönetimi**: CRUD, test fetch
  - **Kategori ve Kural Yönetimi**: Kategori, lokasyon kuralları
  - **Haber Yönetimi**: Admin haber listesi, düzenleme, publish/unpublish
  - **Dashboard ve Operasyon**: İstatistikler, log'lar, job yönetimi
  - **Sosyal Medya Yönetimi**: Hesap bağlama, paylaşım onayı, zamanlama
  - **Webhook Endpoints**: Meta callback handling
  - **Internal Service Endpoints**: Servisler arası iletişim
- Webhook tasarımı (Meta verification, signature validation)
- Güvenlik ve gözlemlenebilirlik (input validation, structured logging, audit)

**Kimlere Önerilir**: Frontend developer, API consumer, integration developer

---

## Temel Kavramlar

### Haber İşleme Pipeline'ı
```
1. RSS Fetch       → Ham haber çekilir (raw_articles)
2. AI Classify     → GPT-4o-mini ile kategori + lokasyon (articles.status: classified)
3. Location Filter → Lokasyon kurallarına uymazsa elenir (filtered_out)
4. AI Rewrite      → GPT-4o ile Türkçe çeviri + başlık + sosyal metin (rewritten)
5. Moderation      → Opsiyonel admin onayı (pending_review → approved)
6. Web Publish     → Haber web sitesinde yayında (publication_status: published)
7. Social Queue    → Sosyal medya paylaşım kuyruğu (social_posts)
8. Social Publish  → Instagram/Facebook'ta yayın (social_post_status: published)
```

### 4 Ana Kategori
| Kategori | Emoji | Severity | Lokasyon Bağımlı | Açıklama |
|----------|-------|----------|------------------|----------|
| **SON DAKIKA** | 🔴 | critical | ✅ Evet | Kaza, yangın, operasyon - sadece Gümülcine/İskeçe/Dedeağaç |
| **DUYURU** | 🟡 | high | ✅ Evet | Kesintiler, yol kapamaları - sadece Gümülcine/İskeçe/Dedeağaç |
| **ÖDEME HABERI** | 🟢 | medium | ❌ Hayır | Maaş, hibe, destek - **Yunanistan geneli** |
| **GENEL BILGI** | 🔵 | low | ✅ Evet | Belediye hizmetleri - sadece Gümülcine/İskeçe/Dedeağaç |

### Konfigürasyon Yaklaşımı
- **Environment Variables**: Database credentials, API keys, secrets
- **Database Config**: Business logic (moderation toggle, category rules, location filters)
- **Avantaj**: Kod değişikliği olmadan davranış değiştirilebilir

### Moderasyon Modu
- **Web Publish Moderation**: `system_settings.moderation.web_publish.enabled`
  - `false` (default): Otomatik yayın
  - `true`: Admin onayı gerekli
- **Social Publish Moderation**: `system_settings.moderation.social_publish.enabled`
  - `false` (default): Otomatik sosyal medya paylaşımı
  - `true`: Admin onayı gerekli

---

## Hızlı Başlangıç Rehberi

### Dokümantasyon Okuma Sırası

#### Yeni Geliştiriciler İçin
1. Bu README dosyasını okuyun
2. `ARCHITECTURE.md` → "Sistem Bağlamı" ve "Servis İletişim Akışı" bölümlerini inceleyin
3. `DATABASE.md` → "Veri Modeli Prensipleri" ve "Ana Tablolar" bölümlerini inceleyin
4. `API.md` → İlgilendiğiniz endpoint gruplarını inceleyin

#### Backend Geliştirme İçin
1. `DATABASE.md` → Tüm tablolar ve Prisma schema
2. `API.md` → Internal service endpoints
3. `ARCHITECTURE.md` → Queue yapısı ve servis iletişimi

#### Frontend Geliştirme İçin
1. `API.md` → Public content API ve admin API
2. `ARCHITECTURE.md` → Auth akışı ve environment variables
3. `DATABASE.md` → Response şemalarını anlamak için tablo yapıları

#### DevOps / Deployment İçin
1. `ARCHITECTURE.md` → Deployment yapısı, Docker Compose, environment variables
2. `DATABASE.md` → Database migration stratejisi
3. `API.md` → Health check endpoints, webhook setup

---

## Proje Fazları

### Phase 1: MVP (4-6 hafta)
**Kapsam**: Çekirdek RSS ingest, AI pipeline, admin panel, web yayını, manuel sosyal medya

**Hedefler**:
- RSS kaynaklardan haber toplama ✅
- AI sınıflandırma ve filtreleme ✅
- Türkçe çeviri ve başlık oluşturma ✅
- Admin panel (CRUD, moderasyon) ✅
- Web haber sitesi ✅
- Manuel sosyal medya paylaşımı ✅

**Referans Dokümanlar**:
- `ARCHITECTURE.md` → Servis akışları 1-3
- `DATABASE.md` → Core tables
- `API.md` → Public + Admin endpoints

---

### Phase 2: Otomasyon ve İyileştirmeler (2-3 hafta)
**Kapsam**: Otomatik sosyal medya, AI başlık sadelleştirme, hashtag, özetleme, trend analizi

**Hedefler**:
- Otomatik sosyal medya yayını ✅
- Sosyal medya approval toggle ✅
- AI hashtag üretimi ✅
- Haber özetleme ✅
- Dashboard analytics ✅
- Gelişmiş arama ✅

**Referans Dokümanlar**:
- `ARCHITECTURE.md` → Servis akışı 4, Feature flags
- `DATABASE.md` → social_posts, article_metrics
- `API.md` → Social publish endpoints

---

### Phase 3: Ölçeklenme (3-4 hafta)
**Kapsam**: Çok dilli yapı, mobil API, caching, CDN, monitoring

**Hedefler**:
- TR/GR dil toggle ✅
- Mobil API versioning ✅
- Redis multi-layer cache ✅
- CDN entegrasyonu ✅
- Observability (Sentry, Grafana) ✅

**Referans Dokümanlar**:
- `ARCHITECTURE.md` → Deployment scaling, Monitoring
- `DATABASE.md` → Multi-language support
- `API.md` → Mobile API, Rate limiting v2

---

## Çapraz Referans İndeksi

### Enum ve Status Değerleri
Tüm dokümanlarda aynı terminoloji kullanılmıştır:

| Enum Adı | Değerler | Tanım Yeri | Kullanım Yeri |
|----------|----------|------------|---------------|
| `user_role` | super_admin, admin, editor, viewer | DATABASE.md | API.md (RBAC), ARCHITECTURE.md |
| `article_status` | fetched, classified, filtered_out, rewritten, pending_review, approved, published, unpublished, failed | DATABASE.md | Tüm dokümanlar |
| `publication_status` | draft, scheduled, published, archived | DATABASE.md | API.md, ARCHITECTURE.md |
| `social_platform` | instagram, facebook, twitter, linkedin | DATABASE.md | API.md, ARCHITECTURE.md |
| `social_post_status` | pending, pending_approval, approved, scheduled, publishing, published, failed, cancelled | DATABASE.md | API.md, ARCHITECTURE.md |

### Ana Tablolar
| Tablo Adı | Tanım Yeri | Referans Yerler |
|-----------|------------|-----------------|
| `articles` | DATABASE.md | API.md (tüm article endpoints), ARCHITECTURE.md (pipeline) |
| `categories` | DATABASE.md | API.md (category endpoints), ARCHITECTURE.md (kural motoru) |
| `rss_sources` | DATABASE.md | API.md (RSS endpoints), ARCHITECTURE.md (fetcher service) |
| `social_posts` | DATABASE.md | API.md (social endpoints), ARCHITECTURE.md (publisher service) |
| `system_settings` | DATABASE.md | ARCHITECTURE.md (config model), API.md (moderation) |

### API Endpoint → Database Table Mapping
| Endpoint | Primary Table | Related Tables |
|----------|---------------|----------------|
| `/api/v1/articles` | articles | categories, rss_sources |
| `/api/v1/admin/rss-sources` | rss_sources | rss_fetch_runs |
| `/api/v1/admin/categories` | categories | location_rules, regions |
| `/api/v1/admin/social/posts` | social_posts | articles, social_accounts, social_post_attempts |

---

## Sık Sorulan Sorular

### Q: Yeni bir RSS kaynağı nasıl eklenir?
**A**: Admin panelden veya `POST /api/v1/admin/rss-sources` endpoint'i ile. Detaylar: `API.md` → "RSS Kaynak Yönetimi"

### Q: Yeni kategori eklenebilir mi?
**A**: Evet, `categories` tablosuna yeni kayıt ekleyerek. Detaylar: `DATABASE.md` → "categories" tablosu

### Q: Lokasyon filtreleme nasıl çalışır?
**A**: AI sınıflandırma sonrası `location_rules` tablosundaki kurallarla kontrol edilir. Detaylar: `ARCHITECTURE.md` → "Servis İletişim Akışı - 2. AI Sınıflandırma"

### Q: Moderasyon nasıl açılıp kapatılır?
**A**: `system_settings` tablosunda `moderation.web_publish.enabled` ve `moderation.social_publish.enabled` anahtarları değiştirilir. Detaylar: `DATABASE.md` → "system_settings" ve `ARCHITECTURE.md` → "Konfigürasyon Modeli"

### Q: Sosyal medya approval workflow nedir?
**A**: `system_settings.moderation.social_publish.enabled = true` ise, `social_posts.status = pending_approval` oluşur ve admin onayı bekler. Detaylar: `API.md` → "Sosyal Medya Yönetimi"

### Q: Hata loglama nasıl yapılır?
**A**: `processing_failures` tablosuna kaydedilir ve admin dashboard'da görüntülenir. Detaylar: `DATABASE.md` → "processing_failures" ve `API.md` → "GET /api/v1/admin/logs"

---

## Katkıda Bulunanlar İçin

### Doküman Güncelleme Kuralları
1. **Terminoloji Tutarlılığı**: Enum, status, tablo adlarını değiştirirken üç dosyayı da güncelleyin
2. **Çapraz Referans**: Yeni kavram eklerken ilgili dosyalarda referans verin
3. **Örnek Veriler**: API endpoint örnekleri DATABASE şemasıyla uyumlu olmalı
4. **Versioning**: Major değişikliklerde doküman versiyonlarını belirtin

### Yeni Özellik Ekleme Süreci
1. `ARCHITECTURE.md` → Servis akışına ekleyin
2. `DATABASE.md` → Gerekli tabloları/kolonları ekleyin
3. `API.md` → Endpoint'leri tanımlayın
4. Bu README'yi ilgili bölümlerle güncelleyin

---

## Teknik Destek ve İletişim

### Doküman İçi Navigasyon
- Her dosyanın başında içindekiler tablosu var
- Markdown anchor linkler ile bölümler arası geçiş
- `Ctrl+F` ile anahtar kelime araması

### External Kaynaklar
- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **BullMQ Docs**: https://docs.bullmq.io
- **Meta Graph API**: https://developers.facebook.com/docs/graph-api
- **OpenAI API**: https://platform.openai.com/docs

---

## Lisans ve Telif Hakları
Bu proje TrakyaHaberBot için hazırlanmış özel dokümantasyondur.

---

**Son Güncelleme**: 2024-01-15  
**Doküman Versiyonu**: 1.0.0  
**Hazırlayan**: Senior Software Architect

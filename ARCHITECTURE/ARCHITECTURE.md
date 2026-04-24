# TrakyaHaberBot - Sistem Mimarisi

## İçindekiler
- [Sistem Bağlamı ve Ana Bileşenler](#sistem-bağlamı-ve-ana-bileşenler)
- [Sistem Mimarisi Diyagramı](#sistem-mimarisi-diyagramı)
- [Servis İletişim Akışı](#servis-iletişim-akışı)
- [Monorepo Klasör Yapısı](#monorepo-klasör-yapısı)
- [Teknoloji Kararları ve Gerekçeleri](#teknoloji-kararları-ve-gerekçeleri)
- [Konfigürasyon Modeli](#konfigürasyon-modeli)
- [Environment Değişkenleri](#environment-değişkenleri)
- [Deployment Yapısı](#deployment-yapısı)
- [Faz Bazlı Uygulama Planı](#faz-bazlı-uygulama-planı)

---

## Sistem Bağlamı ve Ana Bileşenler

### Kullanıcı Tipleri
- **Ziyaretçiler**: Haber sitesini okuyan genel kullanıcılar
- **Admin Kullanıcıları**: İçerik yöneticileri, editörler
- **Worker Servisleri**: Arka plan işleyiciler (RSS Fetcher, AI Worker)
- **Sosyal Medya Platformları**: Facebook, Instagram (Meta Graph API)

### Ana Modüller

#### 1. **Web (Public News Site)**
- Modern, mobil uyumlu haber platformu
- SEO-optimize edilmiş dinamik sayfalar
- Kategori bazlı listeleme ve detay sayfaları
- Arama fonksiyonu
- Next.js App Router ile sunucu taraflı render

#### 2. **Admin Panel**
- RSS kaynak yönetimi
- Kategori ve lokasyon kuralları yönetimi
- Haber moderasyonu ve düzenleme
- Sosyal medya hesap ve paylaşım yönetimi
- Dashboard ve istatistikler
- NextAuth.js tabanlı kimlik doğrulama

#### 3. **API Layer**
- Public content API (gelecekte mobil uygulama için)
- Admin management API
- Internal service API
- Webhook endpoints (Meta callbacks)
- Next.js Route Handlers ile implement

#### 4. **RSS Fetcher Service**
- Periyodik RSS kaynaklarını tarayan bağımsız servis
- Duplicate detection (URL hash bazlı)
- Raw article extraction ve normalizasyon
- BullMQ kuyruğuna job gönderimi
- Hata yönetimi ve retry mantığı

#### 5. **AI Worker Service**
- BullMQ consumer servisi
- İki aşamalı LLM pipeline:
  - **GPT-4o-mini**: Sınıflandırma, lokasyon filtresi, kategori ataması
  - **GPT-4o**: Yunanca→Türkçe çeviri, başlık yeniden yazımı, sosyal medya metni
- Prompt template management
- Rate limiting ve token budget tracking

#### 6. **Scheduler / Queue Orchestration**
- BullMQ ile job scheduling
- Cron-based RSS polling (5-10 dakika interval)
- Job retry ve error handling
- Dead letter queue yönetimi

#### 7. **Data Layer**
- **PostgreSQL**: Ana veri deposu
- **Redis**: Queue backend, cache, rate limiting
- **Object Storage**: Haber görselleri (local volume veya S3-compatible)

#### 8. **Social Media Publisher**
- Meta Graph API entegrasyonu
- Instagram ve Facebook paylaşım yönetimi
- Scheduling ve queue-based publishing
- Approval workflow (toggle ile aktif/pasif)
- Webhook event processing

---

## Sistem Mimarisi Diyagramı

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
├──────────────────────────────┬──────────────────────────────────────────┤
│   Public Web Visitors        │   Admin Users                            │
│   (Mobile/Desktop Browser)   │   (Admin Panel Dashboard)                │
└──────────────┬───────────────┴──────────────────┬───────────────────────┘
               │                                  │
               │ HTTPS                            │ HTTPS
               │                                  │ (Auth: NextAuth Session)
               ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      APPLICATION / API LAYER                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              Next.js 14+ App (App Router)                          │ │
│  │  ┌──────────────┬──────────────────┬─────────────────────────┐   │ │
│  │  │  Public Web  │  Admin Dashboard │   REST API Routes       │   │ │
│  │  │  (SSR Pages) │  (Protected)     │   - /api/v1/articles    │   │ │
│  │  │              │                  │   - /api/v1/admin/*     │   │ │
│  │  │              │                  │   - /api/v1/internal/*  │   │ │
│  │  │              │                  │   - /api/v1/webhooks/*  │   │ │
│  │  └──────────────┴──────────────────┴─────────────────────────┘   │ │
│  └─────────────────────────────┬──────────────────────────────────────┘ │
└────────────────────────────────┼─────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
          ┌──────────────┐ ┌──────────┐ ┌──────────────┐
          │  PostgreSQL  │ │  Redis   │ │ Object Store │
          │   (Prisma)   │ │ (Cache & │ │  (Images)    │
          │              │ │  Queue)  │ │              │
          └──────────────┘ └────┬─────┘ └──────────────┘
                                │
                                │ BullMQ Queues:
                                │ - rss:fetch
                                │ - ai:classify
                                │ - ai:rewrite
                ┌───────────────┼──────────────┐
                │               │              │
                ▼               ▼              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      BACKGROUND WORKERS LAYER                            │
│  ┌───────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │  RSS Fetcher      │  │   AI Worker      │  │  Publisher Worker  │   │
│  │  Service          │  │   Service        │  │  Service           │   │
│  │                   │  │                  │  │                    │   │
│  │  - Cron scheduler │  │  - BullMQ        │  │  - Social media    │   │
│  │  - Fetch RSS      │  │    consumer      │  │    queue consumer  │   │
│  │  - Normalize data │  │  - GPT-4o-mini   │  │  - Meta Graph API  │   │
│  │  - Push to queue  │  │  - GPT-4o        │  │  - Instagram       │   │
│  │  - Duplicate      │  │  - Filter logic  │  │  - Facebook        │   │
│  │    detection      │  │  - Rewrite logic │  │  - Retry handling  │   │
│  └─────────┬─────────┘  └────────┬─────────┘  └─────────┬──────────┘   │
└────────────┼──────────────────────┼──────────────────────┼───────────────┘
             │                      │                      │
             ▼                      ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL INTEGRATIONS                               │
│  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────┐   │
│  │  RSS Sources     │  │  OpenAI API     │  │  Meta Graph API      │   │
│  │                  │  │                 │  │                      │   │
│  │  - xronos.gr     │  │  - GPT-4o-mini  │  │  - Instagram API     │   │
│  │  - thrakinea.gr  │  │  - GPT-4o       │  │  - Facebook Pages    │   │
│  │  - paratiritis   │  │                 │  │  - Webhooks          │   │
│  │  - ...more       │  │                 │  │                      │   │
│  └──────────────────┘  └─────────────────┘  └──────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Servis İletişim Akışı

### 1. RSS Ingest Akışı

```mermaid
flowchart TD
    A[Cron Scheduler] -->|Her 5-10 dk| B[RSS Fetcher Service]
    B -->|HTTP GET| C[RSS Sources]
    C -->|XML Feed| B
    B -->|Parse & Normalize| D{Duplicate Check}
    D -->|URL Hash Exists| E[Skip Article]
    D -->|New Article| F[Save to raw_articles]
    F -->|Push Job| G[BullMQ: rss:normalize]
    G -->|Trigger| H[AI Worker: Classify Job]
```

### 2. AI Sınıflandırma ve Filtreleme Akışı

```mermaid
flowchart TD
    A[AI Worker: Classify Consumer] -->|Fetch Job| B[BullMQ Queue]
    B -->|raw_article data| C[Load Prompt Template]
    C -->|Construct Prompt| D[GPT-4o-mini API Call]
    D -->|Response| E{Parse Classification}
    E -->|Category| F[Check Location Rules]
    F -->|SON DAKIKA/DUYURU/GENEL BILGI| G{Location Match?}
    G -->|Not Gümülcine/İskeçe/Dedeağaç| H[Mark: filtered_out]
    G -->|Match| I[Mark: classified]
    F -->|ÖDEME HABERI| I
    E -->|Invalid/Error| J[Retry or DLQ]
    I -->|Push to Queue| K[BullMQ: ai:rewrite]
```

### 3. AI Çeviri ve Yeniden Yazım Akışı

```mermaid
flowchart TD
    A[AI Worker: Rewrite Consumer] -->|Fetch Job| B[BullMQ: ai:rewrite]
    B -->|classified article| C[Load Rewrite Prompt]
    C -->|Construct Prompt| D[GPT-4o API Call]
    D -->|Yunanca→Türkçe Çeviri| E[Parse Response]
    E -->|Title + Body + Social Text| F[Save to articles table]
    F -->|Status: rewritten| G{Moderation Enabled?}
    G -->|Yes| H[Status: pending_review]
    G -->|No| I[Status: approved]
    I -->|Auto-publish| J[Mark: published]
    J -->|Trigger| K[Social Media Queue]
    H -->|Wait| L[Admin Approval]
    L -->|Approve| I
```

### 4. Sosyal Medya Paylaşım Akışı

```mermaid
flowchart TD
    A[Article Published] -->|Trigger| B{Social Approval Required?}
    B -->|Yes| C[Status: social_pending]
    C -->|Admin Approves| D[Push to Queue]
    B -->|No| D[BullMQ: social:publish]
    D -->|Fetch Job| E[Publisher Worker]
    E -->|Load Social Accounts| F{Platform?}
    F -->|Instagram| G[Format Carousel Post]
    F -->|Facebook| H[Format Link Post]
    G -->|Meta Graph API| I[POST /instagram/media]
    H -->|Meta Graph API| J[POST /facebook/feed]
    I -->|Success| K[Update social_posts: published]
    J -->|Success| K
    I -->|Error| L[Retry Logic]
    J -->|Error| L
    L -->|Max Retries| M[DLQ & Alert]
```

### 5. Hata Yönetimi ve Retry Stratejisi

- **RSS Fetch Failure**: Exponential backoff, 3 retry, sonra alert
- **AI API Failure**: Rate limit aware retry, alternatif model fallback
- **Social Publish Failure**: 5 retry, sonra manual intervention flag
- **Dead Letter Queue**: Tüm kritik job'lar için DLQ, admin dashboard'da görüntüleme

---

## Monorepo Klasör Yapısı

```
TrakyaHaberBot/
├── apps/
│   └── web/                          # Next.js 14+ App Router
│       ├── app/                      # App Router pages
│       │   ├── (public)/            # Public routes
│       │   │   ├── page.tsx         # Ana sayfa
│       │   │   ├── [category]/      # Kategori sayfaları
│       │   │   └── [category]/[slug]/  # Haber detay
│       │   ├── admin/               # Admin panel (protected)
│       │   │   ├── layout.tsx       # Auth wrapper
│       │   │   ├── dashboard/
│       │   │   ├── articles/
│       │   │   ├── rss-sources/
│       │   │   ├── categories/
│       │   │   ├── social/
│       │   │   └── settings/
│       │   └── api/                 # API routes
│       │       └── v1/
│       │           ├── articles/
│       │           ├── admin/
│       │           ├── internal/
│       │           └── webhooks/
│       ├── components/              # React components
│       ├── lib/                     # Utilities
│       └── public/                  # Static assets
│
├── services/
│   ├── rss-fetcher/                 # RSS polling service
│   │   ├── src/
│   │   │   ├── index.ts            # Main entry
│   │   │   ├── scheduler.ts        # Cron jobs
│   │   │   ├── fetcher.ts          # RSS fetch logic
│   │   │   └── normalizer.ts       # Data normalization
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── ai-worker/                   # AI processing service
│   │   ├── src/
│   │   │   ├── index.ts            # BullMQ consumer
│   │   │   ├── consumers/
│   │   │   │   ├── classify.ts     # GPT-4o-mini classification
│   │   │   │   └── rewrite.ts      # GPT-4o translation
│   │   │   ├── llm/
│   │   │   │   ├── openai.ts       # OpenAI client
│   │   │   │   └── prompts.ts      # Prompt builders
│   │   │   └── filters/
│   │   │       ├── location.ts     # Location filtering
│   │   │       └── category.ts     # Category rules
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── publisher/                   # Social media publisher
│       ├── src/
│       │   ├── index.ts            # BullMQ consumer
│       │   ├── consumers/
│       │   │   └── publish.ts      # Publish job handler
│       │   ├── platforms/
│       │   │   ├── instagram.ts    # Instagram API
│       │   │   └── facebook.ts     # Facebook API
│       │   └── formatters/
│       │       └── content.ts      # Content formatting
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── database/                    # Prisma + DB utilities
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── client.ts           # Prisma client singleton
│   │   │   └── types.ts            # Generated types export
│   │   └── package.json
│   │
│   ├── queue/                       # BullMQ configuration
│   │   ├── src/
│   │   │   ├── client.ts           # Queue connection
│   │   │   ├── queues.ts           # Queue definitions
│   │   │   └── jobs.ts             # Job type definitions
│   │   └── package.json
│   │
│   ├── ai/                          # AI/LLM shared utilities
│   │   ├── src/
│   │   │   ├── openai.ts           # OpenAI client wrapper
│   │   │   ├── prompts/            # Prompt templates
│   │   │   └── types.ts            # AI response types
│   │   └── package.json
│   │
│   ├── logger/                      # Structured logging
│   │   ├── src/
│   │   │   └── index.ts            # Pino/Winston setup
│   │   └── package.json
│   │
│   ├── config/                      # Shared config
│   │   ├── src/
│   │   │   ├── env.ts              # Env validation (zod)
│   │   │   └── constants.ts        # App constants
│   │   └── package.json
│   │
│   ├── types/                       # Shared TypeScript types
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── ui/                          # Shared UI components (optional)
│       ├── src/
│       │   └── components/
│       └── package.json
│
├── docker-compose.yml               # Local/VPS deployment
├── turbo.json                       # Turborepo config
├── pnpm-workspace.yaml              # pnpm workspaces
├── package.json                     # Root package
├── .env.example                     # Example environment vars
└── README.md
```

---

## Teknoloji Kararları ve Gerekçeleri

### Next.js 14+ App Router
**Karar**: Frontend, admin panel ve API'yi tek Next.js uygulamasında toplamak.

**Gerekçeler**:
- **Server Components**: SEO için sunucu taraflı render, hızlı initial load
- **Route Handlers**: REST API için native destek, ayrı Express sunucuya gerek yok
- **App Router**: Modern routing, layout composition, streaming SSR
- **Vercel optimizasyonu**: Gelecekte Vercel'e geçiş kolay
- **TypeScript first-class**: Tip güvenliği ve DX

### PostgreSQL + Prisma ORM
**Karar**: İlişkisel veri için PostgreSQL, ORM olarak Prisma.

**Gerekçeler**:
- **İlişkisel veri modeli**: Haberler, kategoriler, kullanıcılar, ilişkiler net
- **JSONB desteği**: Esnek metadata ve config storage
- **Full-text search**: PostgreSQL native arama (future-proof)
- **Prisma DX**: Type-safe queries, migration yönetimi, multi-workspace support
- **Maturity**: Production-ready, iyi dokümantasyon

### BullMQ + Redis
**Karar**: Job queue için BullMQ, backend olarak Redis.

**Gerekçeler**:
- **Reliability**: Guaranteed delivery, job persistence
- **Retry logic**: Built-in exponential backoff, dead letter queue
- **Priority queues**: Önemli haberleri öncelikli işleme
- **Rate limiting**: OpenAI API rate limit yönetimi
- **Observability**: Job durumları ve metrikler
- **Horizontal scaling**: Worker sayısı artırılabilir

### Mikroservis-Odaklı Ayrım (Monorepo İçinde)
**Karar**: RSS Fetcher, AI Worker ve Publisher'ı ayrı servisler olarak kurgulamak, tek monorepo içinde yönetmek.

**Gerekçeler**:
- **Separation of concerns**: Her servis tek sorumluluk
- **Independent scaling**: AI Worker resource-intensive, bağımsız scale edilebilir
- **Deployment flexibility**: Docker Compose'da ayrı container'lar
- **Technology agnostic**: Gelecekte farklı dilde servis eklenebilir
- **Shared packages**: Monorepo ile code reuse (database, queue, logger)

### İki Aşamalı LLM Stratejisi
**Karar**: Sınıflandırma için GPT-4o-mini, çeviri/rewrite için GPT-4o.

**Gerekçeler**:
- **Maliyet optimizasyonu**: 
  - GPT-4o-mini ~60x daha ucuz, günde yüzlerce haber için kritik
  - Sınıflandırma basit task, mini model yeterli
- **Kalite gereksinimleri**: 
  - Çeviri ve başlık yazımı için GPT-4o kalitesi şart
  - Sosyal medya metni marka imajını etkiler
- **Hız**: GPT-4o-mini daha hızlı, pipeline throughput artar
- **Fallback seçenekleri**: İhtiyaç halinde model değişimi kolay

### Config/DB-Driven Kural Motoru
**Karar**: Kategoriler, lokasyon filtreleri, moderasyon toggle'larını hardcode yerine DB/config'de tutmak.

**Gerekçeler**:
- **Esneklik**: Yeni kategori/kural ekleme için kod değişikliği gerekmez
- **Admin kontrolü**: Admin panel üzerinden yönetim
- **A/B testing**: Farklı kural setlerini test edebilme
- **Audit trail**: Kural değişikliklerinin log'lanması
- **Multi-tenant ready**: Gelecekte farklı bölgeler için farklı kurallar

### Docker Compose ile İlk Dağıtım
**Karar**: Production başlangıcı için tek VPS + Docker Compose.

**Gerekçeler**:
- **Simplicity**: Kubernetes complexity'si gerekmez
- **Cost efficiency**: Tek VPS maliyet-etkin başlangıç
- **Full control**: VPS üzerinde tam kontrol
- **Easy migration**: İleride K8s/ECS'e geçiş için hazırlık
- **Rapid deployment**: CI/CD basit, docker-compose up yeterli

---

## Konfigürasyon Modeli

### Environment Variable vs DB Config Ayrımı

#### Environment Variables (`.env` / OS Env)
**Kullanım**: Deployment-specific, secret, infrastructure config

- Database credentials
- Redis connection
- OpenAI API key
- Meta API credentials
- Service URLs
- Environment (dev/staging/prod)
- Log level
- Feature flag overrides (emergency)

#### Database Config (`system_settings`, `feature_flags` tables)
**Kullanım**: Business logic, runtime-changeable, admin-manageable

- RSS polling interval
- Moderation toggle (web publish approval required)
- Social approval toggle (social publish approval required)
- Category active/inactive
- Location filter rules
- AI model selection (gpt-4o vs gpt-4o-mini override)
- Rate limits (requests per minute)
- Retry policies (max attempts, backoff)
- Social media posting schedule

### Kural Motoru Davranışları

#### 1. Kategori Yönetimi
- DB'de `categories` tablosu
- Her kategori: `name`, `emoji`, `severity`, `is_active`, `location_dependent`
- Admin panel üzerinden aktif/pasif yapılabilir
- Yeni kategori ekleme kod değişikliği gerektirmez

#### 2. Lokasyon Filtreleme
- DB'de `location_rules` ve `regions` tabloları
- Lokasyon alias'ları: "Komotini" = "Gümülcine", "Xanthi" = "İskeçe"
- Kategori bazlı lokasyon bağımlılığı:
  - `ÖDEME HABERI`: `location_dependent = false`
  - Diğerleri: `location_dependent = true` + `allowed_regions`
- Admin panel üzerinden yeni bölge/alias ekleme

#### 3. Moderasyon Toggle
- `system_settings` tablosunda:
  - `moderation.web_publish.enabled` (default: false)
  - `moderation.social_publish.enabled` (default: false)
- `false` ise: Haber otomatik `approved` ve `published`
- `true` ise: Haber `pending_review`, admin onayı gerekir

#### 4. AI Model Override
- `system_settings.ai.classification_model` (default: "gpt-4o-mini")
- `system_settings.ai.rewrite_model` (default: "gpt-4o")
- Emergency'de model değişikliği için kod deploy gerekmez

#### 5. Sosyal Medya Davranışı
- Her `social_accounts` kaydında:
  - `auto_publish` (boolean)
  - `publish_delay_minutes` (int)
  - `active` (boolean)
- Global toggle + hesap bazlı override

---

## Environment Değişkenleri

### App Runtime
| Değişken | Açıklama | Örnek | Zorunlu |
|----------|----------|-------|---------|
| `NODE_ENV` | Çalışma ortamı | `production` | Evet |
| `APP_URL` | Uygulama base URL | `https://trakyahaber.com` | Evet |
| `PORT` | Web app port | `3000` | Hayır (default: 3000) |
| `LOG_LEVEL` | Log seviyesi | `info` | Hayır (default: info) |

### Database
| Değişken | Açıklama | Örnek | Zorunlu |
|----------|----------|-------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/trakyahaber` | Evet |
| `DATABASE_POOL_SIZE` | Connection pool boyutu | `10` | Hayır (default: 10) |

### Redis / Queue
| Değişken | Açıklama | Örnek | Zorunlu |
|----------|----------|-------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | Evet |
| `REDIS_PASSWORD` | Redis şifresi | `secret123` | Hayır |
| `QUEUE_CONCURRENCY` | Worker concurrency | `5` | Hayır (default: 5) |

### Auth / Session
| Değişken | Açıklama | Örnek | Zorunlu |
|----------|----------|-------|---------|
| `NEXTAUTH_URL` | NextAuth callback URL | `https://trakyahaber.com` | Evet |
| `NEXTAUTH_SECRET` | Session encryption key | `random-32-char-string` | Evet |
| `ADMIN_EMAIL` | İlk admin email (seed) | `admin@trakyahaber.com` | Evet |
| `ADMIN_PASSWORD` | İlk admin şifre (seed) | `changeme123` | Evet |

### OpenAI
| Değişken | Açıklama | Örnek | Zorunlu |
|----------|----------|-------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` | Evet |
| `OPENAI_ORG_ID` | Organization ID | `org-...` | Hayır |
| `OPENAI_MAX_TOKENS` | Max tokens per request | `2000` | Hayır (default: 2000) |
| `OPENAI_RATE_LIMIT_RPM` | Requests per minute limit | `60` | Hayır (default: 60) |

### Meta APIs (Facebook/Instagram)
| Değişken | Açıklama | Örnek | Zorunlu |
|----------|----------|-------|---------|
| `META_APP_ID` | Meta App ID | `123456789` | Evet |
| `META_APP_SECRET` | Meta App Secret | `abc123...` | Evet |
| `META_WEBHOOK_VERIFY_TOKEN` | Webhook doğrulama token | `random-string` | Evet |
| `META_GRAPH_API_VERSION` | API versiyonu | `v18.0` | Hayır (default: v18.0) |

### Storage / Image
| Değişken | Açıklama | Örnek | Zorunlu |
|----------|----------|-------|---------|
| `STORAGE_TYPE` | Storage tipi | `local` veya `s3` | Hayır (default: local) |
| `STORAGE_PATH` | Local storage path | `/app/uploads` | Hayır (default: ./uploads) |
| `S3_BUCKET` | S3 bucket name | `trakyahaber-media` | Hayır (S3 kullanılırsa evet) |
| `S3_REGION` | S3 region | `eu-central-1` | Hayır |
| `S3_ACCESS_KEY` | S3 access key | `AKIA...` | Hayır |
| `S3_SECRET_KEY` | S3 secret key | `secret...` | Hayır |

### Logging / Monitoring
| Değişken | Açıklama | Örnek | Zorunlu |
|----------|----------|-------|---------|
| `SENTRY_DSN` | Sentry DSN (opsiyonel) | `https://...@sentry.io/...` | Hayır |
| `LOGFLARE_API_KEY` | Logflare API key (opsiyonel) | `api-key` | Hayır |

### Feature Flags (Emergency Override)
| Değişken | Açıklama | Örnek | Zorunlu |
|----------|----------|-------|---------|
| `FORCE_MODERATION` | Moderasyonu zorla aç | `true` | Hayır |
| `DISABLE_SOCIAL_PUBLISH` | Sosyal medya yayını kapat | `true` | Hayır |
| `DISABLE_RSS_FETCH` | RSS çekimini kapat | `true` | Hayır |

---

## Deployment Yapısı

### Tek VPS Docker Compose Topolojisi

```yaml
# docker-compose.yml yapısı

services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: trakyahaber
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - META_APP_ID=${META_APP_ID}
      - META_APP_SECRET=${META_APP_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  rss-fetcher:
    build:
      context: .
      dockerfile: services/rss-fetcher/Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - LOG_LEVEL=info
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  ai-worker:
    build:
      context: .
      dockerfile: services/ai-worker/Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - QUEUE_CONCURRENCY=3
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      replicas: 2  # Ölçeklendirilebilir

  publisher:
    build:
      context: .
      dockerfile: services/publisher/Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - META_APP_ID=${META_APP_ID}
      - META_APP_SECRET=${META_APP_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Reverse Proxy (Opsiyonel Nginx/Caddy)

Nginx örnek config:
```nginx
upstream web_app {
    server web:3000;
}

server {
    listen 80;
    server_name trakyahaber.com www.trakyahaber.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name trakyahaber.com www.trakyahaber.com;

    ssl_certificate /etc/letsencrypt/live/trakyahaber.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/trakyahaber.com/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://web_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads {
        alias /var/www/trakyahaber/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Secret Management
- **Development**: `.env.local` dosyası (gitignore'da)
- **Production**: 
  - VPS üzerinde `/opt/trakyahaber/.env` dosyası (root-only read)
  - Veya Docker secrets kullanımı
  - Hassas bilgiler (API keys, passwords) environment üzerinden inject
  - Secret rotation stratejisi: quarterly API key rotation

### Backup Strategi
- **Database**: 
  - Daily pg_dump via cron
  - Retention: 7 günlük daily + 4 haftalık weekly
  - S3/Backblaze B2'ye upload
- **Uploads**: 
  - Rsync ile günlük incremental backup
  - Object storage'a mirror

### Health Checks ve Restart Policies
- Her servis için healthcheck tanımlı
- `restart: unless-stopped` policy
- Watchdog script: 5dk'da bir service health kontrolü
- Alert: Telegram/email notification (failed health > 3)

### CI/CD Pipeline (Önerilen)
```yaml
# .github/workflows/deploy.yml örneği
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/trakyahaber
            git pull origin main
            docker-compose pull
            docker-compose up -d --build
            docker-compose exec -T web pnpm prisma migrate deploy
```

---

## Faz Bazlı Uygulama Planı

### Phase 1: MVP - Çekirdek Sistem (4-6 hafta)

#### Kapsam
- RSS ingest ve normalize
- AI sınıflandırma ve filtreleme (GPT-4o-mini)
- AI çeviri ve başlık yazımı (GPT-4o)
- Admin panel (kaynak, kategori, haber yönetimi)
- Web haber sitesi (ana sayfa, kategori, detay)
- Sosyal medya manuel paylaşım
- Basic auth ve moderasyon

#### Bağımlılıklar
- PostgreSQL + Prisma schema
- BullMQ queue setup
- OpenAI API entegrasyonu
- NextAuth.js auth flow
- Meta Graph API connect

#### Tamamlanma Kriterleri
- ✅ RSS kaynaklardan haber çekilebiliyor
- ✅ Haberler otomatik sınıflandırılıyor
- ✅ Lokasyon filtresi çalışıyor
- ✅ Haberler Türkçe'ye çevriliyor ve emoji ekli başlık oluşturuluyor
- ✅ Admin panelden haber görüntülenip düzenlenebiliyor
- ✅ Web sitesinde haberler yayınlanıyor
- ✅ Instagram ve Facebook'a manuel post yapılabiliyor
- ✅ Moderation toggle aktif/pasif edilebiliyor

#### İlgili Doküman Bölümleri
- `ARCHITECTURE.md`: Servis akışları 1-3
- `DATABASE.md`: Core tables (rss_sources, raw_articles, articles, categories, users)
- `API.md`: Public API, Admin RSS/Article/Category endpoints

---

### Phase 2: Otomasyon ve İyileştirmeler (2-3 hafta)

#### Kapsam
- Otomatik sosyal medya yayını (approval toggle ile)
- AI başlık sadelleştirme
- Otomatik hashtag üretimi
- Haber özetleme (summary field)
- Trend analizi (en çok okunan/paylaşılan)
- Dashboard istatistikleri
- Gelişmiş arama (PostgreSQL full-text)

#### Bağımlılıklar
- Phase 1 tamamlanmış
- Social publish queue implementasyonu
- AI prompt iteration ve fine-tuning
- Analytics tablolarının eklenmesi

#### Tamamlanma Kriterleri
- ✅ Haberler otomatik sosyal medyaya paylaşılıyor
- ✅ Sosyal medya approval toggle çalışıyor
- ✅ AI otomatik hashtag üretiyor
- ✅ Haber özetleri oluşturuluyor
- ✅ Dashboard'da istatistikler gösteriliyor
- ✅ Arama fonksiyonu çalışıyor

#### İlgili Doküman Bölümleri
- `ARCHITECTURE.md`: Servis akışı 4, Feature flags
- `DATABASE.md`: social_posts, article_metrics, search indexes
- `API.md`: Social publish endpoints, Analytics endpoints

---

### Phase 3: Ölçeklenme ve Gelişmiş Özellikler (3-4 hafta)

#### Kapsam
- Çok dilli yapı (TR/GR toggle)
- Mobil uygulama için API hardening
- Advanced caching (Redis multi-layer)
- CDN entegrasyonu (CloudFlare)
- Observability (Sentry, Grafana, Prometheus)
- A/B testing framework
- Email newsletter (optional)
- Web push notifications
- Elasticsearch entegrasyonu (advanced search)

#### Bağımlılıklar
- Phase 1 ve 2 tamamlanmış
- Production trafik verisi
- Performans bottleneck analizi
- Monitoring altyapısı

#### Tamamlanma Kriterleri
- ✅ Çok dilli içerik desteği
- ✅ Mobil API rate limit ve versioning
- ✅ Cache hit rate > %80
- ✅ CDN ile static asset delivery
- ✅ Real-time monitoring dashboards
- ✅ Error tracking ve alerting aktif
- ✅ Response time < 200ms (median)

#### İlgili Doküman Bölümleri
- `ARCHITECTURE.md`: Deployment scaling, Monitoring
- `DATABASE.md`: Multi-language tables, Audit logs
- `API.md`: Mobile API versioning, Rate limiting v2

---

## Faz Bağımlılık Diyagramı

```mermaid
graph TD
    A[Phase 1: MVP] --> B[Phase 2: Otomasyon]
    B --> C[Phase 3: Ölçeklenme]
    
    A -->|Temel altyapı| D[RSS Ingest]
    A -->|Temel altyapı| E[AI Pipeline]
    A -->|Temel altyapı| F[Admin Panel]
    A -->|Temel altyapı| G[Web Site]
    
    D --> H[Phase 2: Otomatik Sosyal]
    E --> H
    F --> I[Phase 2: Analytics]
    G --> I
    
    H --> J[Phase 3: Multi-language]
    I --> J
    H --> K[Phase 3: Advanced Caching]
    I --> K
```

---

## Sonraki Adımlar

1. **DATABASE.md**: Detaylı tablo şemaları ve ilişkiler
2. **API.md**: REST endpoint spesifikasyonları
3. **Prisma schema implementasyonu**: Seed data ile birlikte
4. **Docker Compose setup**: Local development environment
5. **Monorepo boilerplate**: Turborepo + pnpm workspaces init

---

## Referanslar

- **Veri Modeli**: `ARCHITECTURE/DATABASE.md`
- **API Sözleşmeleri**: `ARCHITECTURE/API.md`
- **Tech Stack**: Next.js 14+, PostgreSQL, Prisma, BullMQ, Redis
- **Deployment**: Docker Compose, VPS
- **AI**: OpenAI GPT-4o-mini, GPT-4o
- **Social**: Meta Graph API (Instagram, Facebook)

# TrakyaHaberBot

RSS haber toplama, AI sınıflandırma/çeviri, yönetim paneli, web haber platformu ve sosyal medya otomasyon sistemi.

## Gereksinimler

- **Node.js** >= 18
- **pnpm** >= 9.12 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- **Docker** ve **Docker Compose** (PostgreSQL + Redis için)
- **OpenAI API Key** (GPT-4o ve GPT-4o-mini erişimi)

## Hızlı Kurulum

### 1. Environment Dosyası

```bash
cp .env.example .env
```

`.env` dosyasında şu alanları düzenle:
- `OPENAI_API_KEY=sk-...` (zorunlu — AI Worker için)
- `NEXTAUTH_SECRET=...` (rastgele uzun string üret)
- Diğer değerler development için hazır, değiştirmene gerek yok

### 2. Docker — PostgreSQL ve Redis

```bash
docker compose up -d
```

Kontrol:
```bash
docker compose ps
# postgres ve redis "healthy" durumda olmalı
```

### 3. Bağımlılıkları Kur

```bash
pnpm install
```

### 4. Prisma — Veritabanı Oluştur

```bash
# Prisma client üret
pnpm db:generate

# Migration çalıştır (tabloları oluşturur)
pnpm db:migrate

# Seed data yükle (kategoriler, bölgeler, RSS kaynakları, admin kullanıcı)
pnpm db:seed
```

Seed data şunları oluşturur:
- **Admin kullanıcı:** `admin@trakyahaber.com` / `changeme123`
- **4 Kategori:** 🔴 SON DAKİKA, 🟡 DUYURU, 🟢 ÖDEME HABERİ, 🔵 GENEL BİLGİ
- **3 Bölge:** Gümülcine (Komotini), İskeçe (Xanthi), Dedeağaç (Alexandroupoli)
- **5 RSS Kaynağı:** xronos.gr, thrakinea.gr, paratiritis-news.gr, milletgazetesi.gr, ulkugazetesi.net
- **Lokasyon kuralları, system settings, prompt templates**

### 5. Build

```bash
pnpm build
```

## Servisleri Çalıştırma

Her servis ayrı terminal penceresinde çalıştırılır:

### Terminal 1 — Next.js (Web + Admin + API)
```bash
cd apps/web
pnpm dev
```
- Web sitesi: http://localhost:3000
- Admin panel: http://localhost:3000/admin
- Admin giriş: http://localhost:3000/login

### Terminal 2 — RSS Fetcher
```bash
cd services/rss-fetcher
npx tsx src/index.ts
```
RSS kaynaklarından haberleri çeker, normalize eder, duplicate kontrolü yapar ve `ai:classify` queue'ya gönderir.

### Terminal 3 — AI Worker
```bash
cd services/ai-worker
npx tsx src/index.ts
```
Queue'dan haberleri alır ve pipeline uygular:
1. **Çeviri** (GPT-4o) — Yunanca → Türkçe
2. **Sınıflandırma** (GPT-4o-mini) — 4 kategoriden birine ata
3. **Lokasyon Filtresi** — Bölge kontrolü (DB-driven)
4. **Reformat** — Emoji başlık + sosyal medya metni

### Terminal 4 — Publisher (Sosyal Medya)
```bash
cd services/publisher
npx tsx src/index.ts
```
Onaylanan haberleri Instagram ve Facebook'a paylaşır.

> **Not:** Publisher için Meta API ayarları (META_APP_ID, FACEBOOK_PAGE_ACCESS_TOKEN vb.) gerekir. Bu ayarlar olmadan publisher hata verecektir — sosyal medya testini en sona bırak.

## Entegrasyon Test Senaryoları

Aşağıdaki senaryolarla sistemi doğrulayabilirsin:

### Test Hazırlığı
1. Docker çalışıyor mu? `docker compose ps`
2. Seed data yüklü mü? `pnpm db:seed`
3. `.env` dosyasında `OPENAI_API_KEY` var mı?

### Testi Çalıştır
1. Tüm servisleri başlat (web, rss-fetcher, ai-worker)
2. RSS Fetcher çalışınca kaynaklardan haberleri çekecek
3. AI Worker queue'dan alıp sınıflandıracak
4. Admin panelden (http://localhost:3000/admin) sonuçları gör

### Beklenen Sonuçlar

| Senaryo | Haber Tipi | Beklenen Kategori | Lokasyon Filtresi |
|---------|-----------|-------------------|-------------------|
| Gümülcine yangını | Acil | 🔴 SON DAKİKA | ✅ Geçer (Gümülcine) |
| Yol kapama duyurusu | Duyuru | 🟡 DUYURU | ✅ Geçer (Gümülcine) |
| Çocuk parası (Yunanistan) | Ödeme | 🟢 ÖDEME HABERİ | ✅ Geçer (lokasyon bağımsız) |
| Belediye personel alımı | Kamu | 🔵 GENEL BİLGİ | ✅ Geçer (Gümülcine) |
| İskeçe hırsızlık | Olay | 🔴 veya 🔵 | ✅ Geçer (İskeçe) |

### DB'den Sonuçları Kontrol Et

```bash
# Prisma Studio ile görsel kontrol
cd packages/database
npx prisma studio
```
Tarayıcıda http://localhost:5555 açılır — `articles` tablosunda sınıflandırılmış haberleri görebilirsin.

Veya komut satırından:
```bash
# PostgreSQL'e doğrudan bağlan
docker exec -it trakyahaber-postgres psql -U postgres -d trakyahaber

# Son 10 işlenmiş haberi listele
SELECT title, status, location, "categoryId",
       "aiClassification"->>'categorySlug' AS category,
       "aiClassification"->>'confidence' AS confidence,
       "aiClassification"->>'reasoning' AS reasoning
FROM articles
ORDER BY "createdAt" DESC
LIMIT 10;

# Kategoriye göre dağılım
SELECT c.name, c.emoji, COUNT(a.id) as count
FROM articles a
JOIN categories c ON a."categoryId" = c.id
GROUP BY c.name, c.emoji;

# Filtrelenen haberleri gör
SELECT title, status, "aiClassification"->>'detectedLocation' AS location
FROM articles
WHERE status = 'filtered_out';
```

## Proje Yapısı

```
TrakyaHaberBot/
├── apps/web/                    # Next.js 14 (Web + Admin + API)
│   ├── app/(public)/            # Haber sitesi sayfaları
│   ├── app/admin/               # Yönetim paneli
│   └── app/api/v1/              # REST API endpoints
├── services/
│   ├── rss-fetcher/             # RSS çekme + tekilleştirme
│   ├── ai-worker/               # AI sınıflandırma + çeviri pipeline
│   └── publisher/               # Sosyal medya paylaşım
├── packages/
│   ├── database/                # Prisma schema + client
│   ├── queue/                   # BullMQ queue tanımları
│   ├── config/                  # Environment config (Zod)
│   ├── logger/                  # Pino structured logging
│   ├── ai/                      # OpenAI client
│   ├── types/                   # Shared TypeScript types
│   └── ui/                      # Shared UI components
├── ARCHITECTURE/                # Mimari dokümanlar
├── docker-compose.yml           # PostgreSQL + Redis
└── .env.example                 # Tüm environment değişkenleri
```

## Sistem Ayarları (Admin Panel)

| Ayar | Varsayılan | Açıklama |
|------|-----------|----------|
| moderation_enabled | false | Haber yayını öncesi admin onayı |
| social_approval_required | false | Sosyal medya paylaşım öncesi onay |
| rss_fetch_interval | 10 | RSS çekme aralığı (dakika) |
| ai_model_classify | gpt-4o-mini | Sınıflandırma modeli |
| ai_model_rewrite | gpt-4o | Çeviri/yazım modeli |
| ai_confidence_threshold | 0.6 | Bu değerin altında → manuel onay |

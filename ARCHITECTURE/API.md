# TrakyaHaberBot - REST API Dokümantasyonu

## İçindekiler
- [API Tasarım İlkeleri](#api-tasarım-i̇lkeleri)
- [Authentication ve Authorization](#authentication-ve-authorization)
- [Response Format Standardı](#response-format-standardı)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Public Content API](#public-content-api)
  - [Admin Auth & Profile](#admin-auth--profile)
  - [RSS Kaynak Yönetimi](#rss-kaynak-yönetimi)
  - [Kategori ve Kural Yönetimi](#kategori-ve-kural-yönetimi)
  - [Haber Yönetimi](#haber-yönetimi)
  - [Dashboard ve Operasyon](#dashboard-ve-operasyon)
  - [Sosyal Medya Yönetimi](#sosyal-medya-yönetimi)
  - [Webhook Endpoints](#webhook-endpoints)
  - [Internal Service Endpoints](#internal-service-endpoints)
- [Webhook Tasarımı](#webhook-tasarımı)
- [Güvenlik ve Gözlemlenebilirlik](#güvenlik-ve-gözlemlenebilirlik)

---

## API Tasarım İlkeleri

### 1. REST Tabanlı Yaklaşım
- Resource-oriented URL tasarımı
- HTTP verb'leri anlamsal kullanımı (GET, POST, PATCH, DELETE)
- Stateless request'ler
- HATEOAS prensibini takip (links ile ilişkili kaynaklar)

### 2. Versioning
- URL-based versioning: `/api/v1/*`
- Major version değişikliklerinde yeni endpoint: `/api/v2/*`
- Backward compatibility mümkün olduğunca korunur
- Deprecated endpoint'ler için `Sunset` header kullanımı

### 3. Public vs Admin vs Internal Ayrımı
- **Public**: `/api/v1/articles`, `/api/v1/categories` (auth gerekmez, rate limit var)
- **Admin**: `/api/v1/admin/*` (session auth gerekli, rol kontrolü var)
- **Internal**: `/api/v1/internal/*` (service-to-service, API key ile korumalı)

### 4. İdempotent İşlemler
- GET, PUT, DELETE idempotent
- POST non-idempotent ama `Idempotency-Key` header desteği (önemli işlemler için)

### 5. Pagination Standardı
- Cursor-based pagination (performans için)
- Query params: `?cursor=<opaque_cursor>&limit=20`
- Response'da `nextCursor` ve `hasMore` döner

### 6. Filtering ve Sorting
- Query params ile: `?category=son-dakika&sort=-publishedAt`
- Array filter: `?status=published,approved`
- Date range: `?publishedAfter=2024-01-01&publishedBefore=2024-12-31`

---

## Authentication ve Authorization

### Admin Panel Authentication (NextAuth.js)

#### Session-Based Auth
- Cookie-based session management
- `session_token` cookie (httpOnly, secure, sameSite=lax)
- Session TTL: 30 gün (idle timeout: 7 gün)

#### Role-Based Access Control (RBAC)
| Role | Permissions |
|------|-------------|
| `super_admin` | Tüm erişim + user management |
| `admin` | İçerik yönetimi, RSS, kategori, sosyal medya |
| `editor` | Sadece içerik düzenleme ve moderasyon |
| `viewer` | Sadece görüntüleme |

#### Middleware Kontrolü
```typescript
// Pseudocode
async function requireAuth(req, res, next) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  req.user = session.user;
  next();
}

async function requireRole(roles: string[]) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

### Internal Service Authentication

#### Service API Key
- Environment variable: `INTERNAL_API_KEY`
- Header: `X-Internal-API-Key: <key>`
- Key rotation: quarterly
- Request whitelist: Internal services IP adresleri (opsiyonel)

#### Örnek
```http
POST /api/v1/internal/rss/ingest
X-Internal-API-Key: secret-service-key-12345
Content-Type: application/json
```

---

## Response Format Standardı

### Başarılı Response

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    cursor?: string;
    nextCursor?: string | null;
    hasMore?: boolean;
    total?: number;
    limit?: number;
  };
  links?: {
    self?: string;
    next?: string;
    prev?: string;
    related?: Record<string, string>;
  };
  requestId: string;
  timestamp: string;  // ISO 8601
}
```

**Örnek**:
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "🔴 SON DAKIKA: Gümülcine'de Trafik Kazası",
    "slug": "son-dakika-gumulcine-trafik-kazasi",
    "category": {
      "id": "cat-001",
      "name": "SON DAKIKA",
      "slug": "son-dakika"
    },
    "publishedAt": "2024-01-15T10:30:00Z",
    "status": "published"
  },
  "links": {
    "self": "/api/v1/articles/son-dakika-gumulcine-trafik-kazasi"
  },
  "requestId": "req_abc123xyz",
  "timestamp": "2024-01-15T10:35:22Z"
}
```

### Hata Response

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable error message
    details?: unknown;      // Additional error context
    field?: string;         // Field that caused error (validation)
    statusCode: number;     // HTTP status code
  };
  requestId: string;
  timestamp: string;
}
```

**Örnek**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Başlık alanı zorunludur",
    "field": "title",
    "statusCode": 400
  },
  "requestId": "req_error_xyz",
  "timestamp": "2024-01-15T10:35:22Z"
}
```

---

## Error Handling

### HTTP Status Codes
| Code | Açıklama | Kullanım |
|------|----------|----------|
| `200` | OK | Başarılı GET/PATCH/DELETE |
| `201` | Created | Başarılı POST (yeni kaynak) |
| `204` | No Content | Başarılı DELETE (response body yok) |
| `400` | Bad Request | Validation hatası, geçersiz input |
| `401` | Unauthorized | Auth gerekli ama sağlanmamış |
| `403` | Forbidden | Auth var ama yetki yok |
| `404` | Not Found | Kaynak bulunamadı |
| `409` | Conflict | Duplicate kaynak, concurrent modification |
| `422` | Unprocessable Entity | Semantik validation hatası |
| `429` | Too Many Requests | Rate limit aşıldı |
| `500` | Internal Server Error | Sunucu hatası |
| `503` | Service Unavailable | Geçici servis kesintisi |

### Error Codes
| Code | HTTP Status | Açıklama |
|------|-------------|----------|
| `VALIDATION_ERROR` | 400 | Input validation hatası |
| `AUTHENTICATION_REQUIRED` | 401 | Login gerekli |
| `INVALID_CREDENTIALS` | 401 | Yanlış email/password |
| `FORBIDDEN` | 403 | Yetki yok |
| `NOT_FOUND` | 404 | Kaynak bulunamadı |
| `DUPLICATE_RESOURCE` | 409 | Duplicate slug, URL hash vb |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit aşıldı |
| `INTERNAL_ERROR` | 500 | Generic server error |
| `AI_SERVICE_ERROR` | 503 | OpenAI API hatası |
| `SOCIAL_API_ERROR` | 503 | Meta API hatası |

---

## Rate Limiting

### Rate Limit Kuralları

#### Public API
- **Articles List**: 100 req/min per IP
- **Article Detail**: 200 req/min per IP
- **Search**: 30 req/min per IP

#### Admin API
- **Mutation (POST/PATCH/DELETE)**: 60 req/min per user
- **Read (GET)**: 300 req/min per user

#### Internal API
- **RSS Ingest**: 1000 req/min per service
- **AI Process**: Rate limit yok (kuyruk kontrollü)

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642252800  (Unix timestamp)
Retry-After: 60  (429 response'da)
```

### Redis-Based Implementation
```typescript
// Pseudocode
const rateLimitKey = `ratelimit:${endpoint}:${identifier}`;
const count = await redis.incr(rateLimitKey);
if (count === 1) {
  await redis.expire(rateLimitKey, windowSeconds);
}
if (count > limit) {
  throw new RateLimitError();
}
```

---

## API Endpoints

## Public Content API

### `GET /api/v1/articles`
Haber listesi (filtrelenmiş, paginated).

**Auth**: Gerekmez  
**Rate Limit**: 100 req/min per IP

**Query Parameters**:
| Parametre | Tip | Açıklama | Örnek |
|-----------|-----|----------|-------|
| `category` | string | Kategori slug | `son-dakika` |
| `location` | string | Lokasyon | `gumulcine` |
| `cursor` | string | Pagination cursor | `opaque_cursor_abc` |
| `limit` | number | Sonuç sayısı (max 50) | `20` |
| `sort` | string | Sıralama (`-publishedAt`, `publishedAt`) | `-publishedAt` |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "article-001",
      "slug": "son-dakika-gumulcine-trafik-kazasi",
      "title": "🔴 SON DAKIKA: Gümülcine'de Trafik Kazası",
      "summary": "Gümülcine merkez'de meydana gelen trafik kazasında 2 kişi yaralandı.",
      "imageUrl": "https://cdn.trakyahaber.com/images/article-001.jpg",
      "category": {
        "id": "cat-001",
        "name": "SON DAKIKA",
        "slug": "son-dakika",
        "emoji": "🔴"
      },
      "location": "Gümülcine",
      "publishedAt": "2024-01-15T10:30:00Z",
      "viewsCount": 1250,
      "sharesCount": 45
    }
  ],
  "meta": {
    "nextCursor": "cursor_xyz789",
    "hasMore": true,
    "limit": 20
  },
  "links": {
    "self": "/api/v1/articles?category=son-dakika&limit=20",
    "next": "/api/v1/articles?category=son-dakika&limit=20&cursor=cursor_xyz789"
  },
  "requestId": "req_abc123",
  "timestamp": "2024-01-15T10:35:00Z"
}
```

---

### `GET /api/v1/articles/:slug`
Haber detayı.

**Auth**: Gerekmez  
**Rate Limit**: 200 req/min per IP

**Path Parameters**:
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `slug` | string | Haber slug |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "article-001",
    "slug": "son-dakika-gumulcine-trafik-kazasi",
    "title": "🔴 SON DAKIKA: Gümülcine'de Trafik Kazası",
    "content": "<p>Gümülcine merkez'de bu sabah saat 09:30'da meydana gelen...</p>",
    "summary": "Gümülcine merkez'de meydana gelen trafik kazasında 2 kişi yaralandı.",
    "imageUrl": "https://cdn.trakyahaber.com/images/article-001.jpg",
    "category": {
      "id": "cat-001",
      "name": "SON DAKIKA",
      "slug": "son-dakika",
      "emoji": "🔴"
    },
    "source": {
      "name": "Xronos",
      "url": "https://xronos.gr"
    },
    "originalUrl": "https://xronos.gr/original-article",
    "location": "Gümülcine",
    "author": "Editör",
    "publishedAt": "2024-01-15T10:30:00Z",
    "viewsCount": 1250,
    "sharesCount": 45,
    "relatedArticles": [
      {
        "id": "article-002",
        "slug": "trafik-kazalari-artisi",
        "title": "Trafik Kazalarında Artış",
        "imageUrl": "...",
        "publishedAt": "2024-01-14T08:00:00Z"
      }
    ]
  },
  "links": {
    "self": "/api/v1/articles/son-dakika-gumulcine-trafik-kazasi",
    "category": "/api/v1/articles?category=son-dakika"
  },
  "requestId": "req_detail_123",
  "timestamp": "2024-01-15T10:36:00Z"
}
```

**Error**: `404 Not Found`
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Haber bulunamadı",
    "statusCode": 404
  },
  "requestId": "req_error_001",
  "timestamp": "2024-01-15T10:36:00Z"
}
```

---

### `GET /api/v1/categories`
Kategori listesi.

**Auth**: Gerekmez  
**Rate Limit**: 100 req/min per IP

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "cat-001",
      "name": "SON DAKIKA",
      "slug": "son-dakika",
      "emoji": "🔴",
      "description": "Kaza, yangın, doğal afet, operasyon",
      "articleCount": 125
    },
    {
      "id": "cat-002",
      "name": "DUYURU",
      "slug": "duyuru",
      "emoji": "🟡",
      "description": "Kesintiler, yol kapamaları, resmi uyarılar",
      "articleCount": 89
    }
  ],
  "requestId": "req_cat_001",
  "timestamp": "2024-01-15T10:37:00Z"
}
```

---

### `GET /api/v1/search`
Haber arama (full-text search).

**Auth**: Gerekmez  
**Rate Limit**: 30 req/min per IP

**Query Parameters**:
| Parametre | Tip | Açıklama | Örnek |
|-----------|-----|----------|-------|
| `q` | string | Arama sorgusu (min 3 karakter) | `gümülcine trafik` |
| `category` | string | Kategori filtresi | `son-dakika` |
| `limit` | number | Sonuç sayısı (max 50) | `20` |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "query": "gümülcine trafik",
    "results": [
      {
        "id": "article-001",
        "slug": "son-dakika-gumulcine-trafik-kazasi",
        "title": "🔴 SON DAKIKA: Gümülcine'de Trafik Kazası",
        "summary": "...",
        "imageUrl": "...",
        "category": { "name": "SON DAKIKA", "slug": "son-dakika", "emoji": "🔴" },
        "publishedAt": "2024-01-15T10:30:00Z",
        "relevanceScore": 0.95
      }
    ],
    "total": 12
  },
  "requestId": "req_search_001",
  "timestamp": "2024-01-15T10:38:00Z"
}
```

---

## Admin Auth & Profile

### `POST /api/v1/admin/auth/login`
Admin giriş (NextAuth.js credentials provider).

**Auth**: Gerekmez  
**Rate Limit**: 10 req/min per IP (brute force koruması)

**Request**:
```json
{
  "email": "admin@trakyahaber.com",
  "password": "securepassword123"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-001",
      "email": "admin@trakyahaber.com",
      "name": "Admin User",
      "role": "admin"
    },
    "expiresAt": "2024-02-14T10:30:00Z"
  },
  "requestId": "req_login_001",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Set-Cookie Header**:
```http
Set-Cookie: session_token=<encrypted_token>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000
```

**Error**: `401 Unauthorized`
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email veya şifre hatalı",
    "statusCode": 401
  },
  "requestId": "req_login_error",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### `POST /api/v1/admin/auth/logout`
Admin çıkış.

**Auth**: Session required  
**Rate Limit**: 60 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Başarıyla çıkış yapıldı"
  },
  "requestId": "req_logout_001",
  "timestamp": "2024-01-15T11:00:00Z"
}
```

---

### `GET /api/v1/admin/me`
Oturum bilgisi.

**Auth**: Session required  
**Rate Limit**: 300 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "user-001",
    "email": "admin@trakyahaber.com",
    "name": "Admin User",
    "role": "admin",
    "isActive": true,
    "lastLoginAt": "2024-01-15T10:30:00Z"
  },
  "requestId": "req_me_001",
  "timestamp": "2024-01-15T10:31:00Z"
}
```

---

## RSS Kaynak Yönetimi

### `GET /api/v1/admin/rss-sources`
RSS kaynak listesi.

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 300 req/min per user

**Query Parameters**:
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `isActive` | boolean | Aktif/pasif filtre |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "source-001",
      "name": "Xronos",
      "url": "https://xronos.gr/rss.xml",
      "websiteUrl": "https://xronos.gr",
      "language": "el",
      "isActive": true,
      "fetchIntervalMinutes": 10,
      "lastFetchedAt": "2024-01-15T10:00:00Z",
      "lastFetchStatus": "success",
      "articlesCount": 1250
    }
  ],
  "requestId": "req_sources_001",
  "timestamp": "2024-01-15T10:40:00Z"
}
```

---

### `POST /api/v1/admin/rss-sources`
Yeni RSS kaynağı ekle.

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 60 req/min per user

**Request**:
```json
{
  "name": "Yeni Haber Sitesi",
  "url": "https://yenisite.gr/feed",
  "websiteUrl": "https://yenisite.gr",
  "language": "el",
  "fetchIntervalMinutes": 10,
  "isActive": true
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "source-new",
    "name": "Yeni Haber Sitesi",
    "url": "https://yenisite.gr/feed",
    "isActive": true,
    "createdAt": "2024-01-15T10:45:00Z"
  },
  "requestId": "req_create_source",
  "timestamp": "2024-01-15T10:45:00Z"
}
```

**Error**: `409 Conflict`
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_RESOURCE",
    "message": "Bu RSS URL zaten mevcut",
    "field": "url",
    "statusCode": 409
  },
  "requestId": "req_error_source",
  "timestamp": "2024-01-15T10:45:00Z"
}
```

---

### `PATCH /api/v1/admin/rss-sources/:id`
RSS kaynağı güncelle.

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 60 req/min per user

**Path Parameters**:
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `id` | UUID | Kaynak ID |

**Request**:
```json
{
  "isActive": false,
  "fetchIntervalMinutes": 15
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "source-001",
    "name": "Xronos",
    "isActive": false,
    "fetchIntervalMinutes": 15,
    "updatedAt": "2024-01-15T10:50:00Z"
  },
  "requestId": "req_update_source",
  "timestamp": "2024-01-15T10:50:00Z"
}
```

---

### `DELETE /api/v1/admin/rss-sources/:id`
RSS kaynağı sil.

**Auth**: Session required (role: super_admin)  
**Rate Limit**: 60 req/min per user

**Response**: `204 No Content`

---

### `POST /api/v1/admin/rss-sources/:id/test`
RSS kaynağını test et (hemen fetch).

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 10 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "status": "success",
    "itemsFetched": 15,
    "itemsNew": 3,
    "itemsDuplicate": 12,
    "durationMs": 2340
  },
  "requestId": "req_test_source",
  "timestamp": "2024-01-15T10:55:00Z"
}
```

---

## Kategori ve Kural Yönetimi

### `GET /api/v1/admin/categories`
Kategori yönetim listesi (tüm bilgilerle).

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 300 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "cat-001",
      "name": "SON DAKIKA",
      "slug": "son-dakika",
      "emoji": "🔴",
      "severity": "critical",
      "locationDependent": true,
      "description": "Kaza, yangın, doğal afet, operasyon",
      "isActive": true,
      "displayOrder": 1,
      "articlesCount": 125,
      "allowedRegions": [
        { "id": "region-001", "name": "Gümülcine" },
        { "id": "region-002", "name": "İskeçe" }
      ]
    }
  ],
  "requestId": "req_admin_cat",
  "timestamp": "2024-01-15T11:00:00Z"
}
```

---

### `PATCH /api/v1/admin/categories/:id`
Kategori güncelle.

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 60 req/min per user

**Request**:
```json
{
  "isActive": false,
  "displayOrder": 5
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "cat-001",
    "name": "SON DAKIKA",
    "isActive": false,
    "displayOrder": 5,
    "updatedAt": "2024-01-15T11:05:00Z"
  },
  "requestId": "req_update_cat",
  "timestamp": "2024-01-15T11:05:00Z"
}
```

---

### `GET /api/v1/admin/location-rules`
Lokasyon kuralları listesi.

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 300 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "rule-001",
      "category": {
        "id": "cat-001",
        "name": "SON DAKIKA",
        "slug": "son-dakika"
      },
      "region": {
        "id": "region-001",
        "nameTr": "Gümülcine",
        "nameEl": "Κομοτηνή"
      },
      "isRequired": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "requestId": "req_loc_rules",
  "timestamp": "2024-01-15T11:10:00Z"
}
```

---

### `POST /api/v1/admin/location-rules`
Yeni lokasyon kuralı ekle.

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 60 req/min per user

**Request**:
```json
{
  "categoryId": "cat-001",
  "regionId": "region-003",
  "isRequired": true
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "rule-new",
    "categoryId": "cat-001",
    "regionId": "region-003",
    "isRequired": true,
    "createdAt": "2024-01-15T11:15:00Z"
  },
  "requestId": "req_create_rule",
  "timestamp": "2024-01-15T11:15:00Z"
}
```

---

### `DELETE /api/v1/admin/location-rules/:id`
Lokasyon kuralı sil.

**Auth**: Session required (role: super_admin)  
**Rate Limit**: 60 req/min per user

**Response**: `204 No Content`

---

## Haber Yönetimi

### `GET /api/v1/admin/articles`
Admin haber listesi (tüm durumlar dahil).

**Auth**: Session required (role: editor, admin, super_admin)  
**Rate Limit**: 300 req/min per user

**Query Parameters**:
| Parametre | Tip | Açıklama | Örnek |
|-----------|-----|----------|-------|
| `status` | string | Haber durumu (virgülle ayrılmış) | `pending_review,approved` |
| `category` | string | Kategori slug | `son-dakika` |
| `cursor` | string | Pagination cursor | `cursor_abc` |
| `limit` | number | Sonuç sayısı (max 100) | `50` |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "article-001",
      "slug": "son-dakika-gumulcine-trafik-kazasi",
      "title": "🔴 SON DAKIKA: Gümülcine'de Trafik Kazası",
      "status": "pending_review",
      "publicationStatus": "draft",
      "category": {
        "name": "SON DAKIKA",
        "slug": "son-dakika",
        "emoji": "🔴"
      },
      "source": {
        "name": "Xronos"
      },
      "location": "Gümülcine",
      "imageUrl": "...",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:32:00Z"
    }
  ],
  "meta": {
    "nextCursor": "cursor_xyz",
    "hasMore": true,
    "limit": 50
  },
  "requestId": "req_admin_articles",
  "timestamp": "2024-01-15T11:20:00Z"
}
```

---

### `GET /api/v1/admin/articles/:id`
Admin haber detayı (tüm alanlar dahil).

**Auth**: Session required (role: editor, admin, super_admin)  
**Rate Limit**: 300 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "article-001",
    "slug": "son-dakika-gumulcine-trafik-kazasi",
    "title": "🔴 SON DAKIKA: Gümülcine'de Trafik Kazası",
    "content": "<p>Haber içeriği...</p>",
    "summary": "Özet...",
    "originalTitle": "Τροχαίο ατύχημα στην Κομοτηνή",
    "originalContent": "Πρωτότυπο κείμενο...",
    "originalUrl": "https://xronos.gr/original",
    "imageUrl": "...",
    "socialText": "Sosyal medya metni",
    "hashtags": ["Gümülcine", "TrafikKazası"],
    "author": "Editör",
    "location": "Gümülcine",
    "status": "pending_review",
    "publicationStatus": "draft",
    "category": {
      "id": "cat-001",
      "name": "SON DAKIKA",
      "slug": "son-dakika"
    },
    "source": {
      "id": "source-001",
      "name": "Xronos",
      "url": "https://xronos.gr/rss.xml"
    },
    "aiClassification": {
      "confidence": 0.95,
      "detectedCategory": "son-dakika",
      "detectedLocation": "Gümülcine"
    },
    "approvedBy": null,
    "approvedAt": null,
    "publishedAt": null,
    "viewsCount": 0,
    "sharesCount": 0,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:32:00Z",
    "revisions": [
      {
        "id": "rev-001",
        "changedBy": { "name": "Admin" },
        "changeReason": "Başlık düzenlendi",
        "createdAt": "2024-01-15T10:32:00Z"
      }
    ]
  },
  "requestId": "req_article_detail",
  "timestamp": "2024-01-15T11:25:00Z"
}
```

---

### `PATCH /api/v1/admin/articles/:id`
Haber düzenle.

**Auth**: Session required (role: editor, admin, super_admin)  
**Rate Limit**: 60 req/min per user

**Request**:
```json
{
  "title": "🔴 SON DAKIKA: Gümülcine Merkez'de Trafik Kazası",
  "content": "<p>Düzenlenmiş içerik...</p>",
  "summary": "Yeni özet",
  "changeReason": "Başlık ve özet güncellendi"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "article-001",
    "title": "🔴 SON DAKIKA: Gümülcine Merkez'de Trafik Kazası",
    "updatedAt": "2024-01-15T11:30:00Z",
    "revisionCreated": true
  },
  "requestId": "req_update_article",
  "timestamp": "2024-01-15T11:30:00Z"
}
```

---

### `POST /api/v1/admin/articles/:id/publish`
Haberi onayla ve yayınla.

**Auth**: Session required (role: editor, admin, super_admin)  
**Rate Limit**: 60 req/min per user

**Request** (opsiyonel):
```json
{
  "scheduledFor": "2024-01-15T12:00:00Z"  // Zamanlanmış yayın (opsiyonel)
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "article-001",
    "status": "approved",
    "publicationStatus": "published",
    "publishedAt": "2024-01-15T11:35:00Z",
    "approvedBy": {
      "id": "user-001",
      "name": "Admin User"
    }
  },
  "requestId": "req_publish",
  "timestamp": "2024-01-15T11:35:00Z"
}
```

---

### `POST /api/v1/admin/articles/:id/unpublish`
Haberi yayından kaldır.

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 60 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "article-001",
    "publicationStatus": "archived",
    "unpublishedAt": "2024-01-15T11:40:00Z"
  },
  "requestId": "req_unpublish",
  "timestamp": "2024-01-15T11:40:00Z"
}
```

---

### `POST /api/v1/admin/articles/:id/reprocess`
Haberi AI pipeline'a tekrar gönder (classification veya rewrite).

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 10 req/min per user

**Request**:
```json
{
  "stage": "rewrite"  // "classification" or "rewrite"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "article-001",
    "status": "fetched",
    "jobId": "job_abc123",
    "message": "Haber yeniden işleme kuyruğuna alındı"
  },
  "requestId": "req_reprocess",
  "timestamp": "2024-01-15T11:45:00Z"
}
```

---

## Dashboard ve Operasyon

### `GET /api/v1/admin/dashboard`
Dashboard özet istatistikleri.

**Auth**: Session required (role: editor, admin, super_admin)  
**Rate Limit**: 300 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalArticles": 1250,
      "publishedToday": 45,
      "pendingReview": 12,
      "failedProcessing": 3,
      "activeRssSources": 5
    },
    "recentArticles": [
      {
        "id": "article-001",
        "title": "🔴 SON DAKIKA: Gümülcine'de Trafik Kazası",
        "status": "published",
        "publishedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "processingQueue": {
      "rss_fetch": { "pending": 0, "running": 2 },
      "ai_classify": { "pending": 5, "running": 3 },
      "ai_rewrite": { "pending": 8, "running": 2 },
      "social_publish": { "pending": 10, "running": 1 }
    },
    "recentErrors": [
      {
        "id": "error-001",
        "stage": "social_publish",
        "entityId": "article-005",
        "errorMessage": "Meta API rate limit",
        "createdAt": "2024-01-15T10:15:00Z"
      }
    ]
  },
  "requestId": "req_dashboard",
  "timestamp": "2024-01-15T11:50:00Z"
}
```

---

### `GET /api/v1/admin/logs`
İşlem log'ları (processing_failures, rss_fetch_runs).

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 300 req/min per user

**Query Parameters**:
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `type` | string | Log tipi (`processing_failure`, `rss_fetch`) |
| `stage` | string | Hata aşaması (processing_failure için) |
| `resolved` | boolean | Çözülmüş mü (processing_failure için) |
| `cursor` | string | Pagination cursor |
| `limit` | number | Sonuç sayısı (max 100) |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "error-001",
      "stage": "social_publish",
      "entityType": "article",
      "entityId": "article-005",
      "errorMessage": "Meta API rate limit exceeded",
      "retryCount": 2,
      "maxRetries": 5,
      "nextRetryAt": "2024-01-15T12:00:00Z",
      "resolved": false,
      "createdAt": "2024-01-15T10:15:00Z"
    }
  ],
  "meta": {
    "nextCursor": "cursor_log_xyz",
    "hasMore": true,
    "limit": 50
  },
  "requestId": "req_logs",
  "timestamp": "2024-01-15T11:55:00Z"
}
```

---

### `GET /api/v1/admin/jobs`
BullMQ job durumları (opsiyonel, debug için).

**Auth**: Session required (role: super_admin)  
**Rate Limit**: 100 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "queues": [
      {
        "name": "rss:fetch",
        "waiting": 0,
        "active": 2,
        "completed": 1250,
        "failed": 5
      },
      {
        "name": "ai:classify",
        "waiting": 5,
        "active": 3,
        "completed": 980,
        "failed": 12
      }
    ]
  },
  "requestId": "req_jobs",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

---

### `POST /api/v1/admin/jobs/rss-fetch`
Manuel RSS fetch tetikleme.

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 10 req/min per user

**Request**:
```json
{
  "sourceId": "source-001"  // Opsiyonel, belirtilmezse tüm aktif kaynaklar
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "RSS fetch job'ları kuyruğa alındı",
    "jobCount": 5
  },
  "requestId": "req_trigger_fetch",
  "timestamp": "2024-01-15T12:05:00Z"
}
```

---

### `POST /api/v1/admin/jobs/social-publish`
Manuel sosyal medya yayını tetikleme.

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 10 req/min per user

**Request**:
```json
{
  "articleId": "article-001"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Sosyal medya yayın job'ı oluşturuldu",
    "socialPostIds": ["post-001", "post-002"]
  },
  "requestId": "req_trigger_social",
  "timestamp": "2024-01-15T12:10:00Z"
}
```

---

## Sosyal Medya Yönetimi

### `GET /api/v1/admin/social/accounts`
Bağlı sosyal medya hesapları.

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 300 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "account-001",
      "platform": "instagram",
      "platformUsername": "@trakyahaber",
      "displayName": "Trakya Haber",
      "isActive": true,
      "autoPublish": true,
      "publishDelayMinutes": 0,
      "tokenExpiresAt": "2024-03-15T00:00:00Z",
      "lastPublishedAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "account-002",
      "platform": "facebook",
      "platformUsername": "TrakyaHaberPage",
      "displayName": "Trakya Haber",
      "isActive": true,
      "autoPublish": true,
      "publishDelayMinutes": 5,
      "tokenExpiresAt": "2024-03-15T00:00:00Z",
      "lastPublishedAt": "2024-01-15T09:55:00Z"
    }
  ],
  "requestId": "req_social_accounts",
  "timestamp": "2024-01-15T12:15:00Z"
}
```

---

### `POST /api/v1/admin/social/accounts/connect`
Yeni sosyal medya hesabı bağla (OAuth flow başlat).

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 10 req/min per user

**Request**:
```json
{
  "platform": "instagram"  // "instagram" or "facebook"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "authUrl": "https://www.facebook.com/v18.0/dialog/oauth?client_id=...",
    "state": "random_state_token_abc123"
  },
  "requestId": "req_social_connect",
  "timestamp": "2024-01-15T12:20:00Z"
}
```

---

### `GET /api/v1/admin/social/posts`
Sosyal medya paylaşımları listesi.

**Auth**: Session required (role: editor, admin, super_admin)  
**Rate Limit**: 300 req/min per user

**Query Parameters**:
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `status` | string | Post durumu (virgülle ayrılmış) |
| `platform` | string | Platform filtresi |
| `cursor` | string | Pagination cursor |
| `limit` | number | Sonuç sayısı (max 100) |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "post-001",
      "article": {
        "id": "article-001",
        "title": "🔴 SON DAKIKA: Gümülcine'de Trafik Kazası",
        "slug": "son-dakika-gumulcine-trafik-kazasi"
      },
      "account": {
        "id": "account-001",
        "platform": "instagram",
        "platformUsername": "@trakyahaber"
      },
      "status": "pending_approval",
      "postType": "feed",
      "text": "🔴 SON DAKIKA\n\nGümülcine merkez'de trafik kazası...",
      "hashtags": ["Gümülcine", "TrafikKazası", "SonDakika"],
      "mediaUrls": ["https://cdn.trakyahaber.com/images/article-001.jpg"],
      "scheduledFor": null,
      "createdAt": "2024-01-15T11:35:00Z"
    }
  ],
  "meta": {
    "nextCursor": "cursor_post_xyz",
    "hasMore": true,
    "limit": 50
  },
  "requestId": "req_social_posts",
  "timestamp": "2024-01-15T12:25:00Z"
}
```

---

### `POST /api/v1/admin/social/posts/:id/approve`
Sosyal medya paylaşımını onayla.

**Auth**: Session required (role: editor, admin, super_admin)  
**Rate Limit**: 60 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "post-001",
    "status": "approved",
    "approvedBy": {
      "id": "user-001",
      "name": "Admin User"
    },
    "approvedAt": "2024-01-15T12:30:00Z"
  },
  "requestId": "req_approve_post",
  "timestamp": "2024-01-15T12:30:00Z"
}
```

---

### `POST /api/v1/admin/social/posts/:id/publish-now`
Sosyal medya paylaşımını hemen yayınla (zamanlamayı override).

**Auth**: Session required (role: admin, super_admin)  
**Rate Limit**: 10 req/min per user

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "post-001",
    "status": "publishing",
    "message": "Yayın işlemi başlatıldı"
  },
  "requestId": "req_publish_now",
  "timestamp": "2024-01-15T12:35:00Z"
}
```

---

### `POST /api/v1/admin/social/posts/:id/schedule`
Sosyal medya paylaşımını zamanla.

**Auth**: Session required (role: editor, admin, super_admin)  
**Rate Limit**: 60 req/min per user

**Request**:
```json
{
  "scheduledFor": "2024-01-15T15:00:00Z"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "post-001",
    "status": "scheduled",
    "scheduledFor": "2024-01-15T15:00:00Z"
  },
  "requestId": "req_schedule_post",
  "timestamp": "2024-01-15T12:40:00Z"
}
```

---

## Webhook Endpoints

### `GET /api/v1/webhooks/meta`
Meta webhook verification (initial handshake).

**Auth**: Gerekmez (Meta'nın verify token'ı ile doğrulama)  
**Rate Limit**: 100 req/min per IP

**Query Parameters**:
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `hub.mode` | string | "subscribe" |
| `hub.challenge` | string | Verification challenge |
| `hub.verify_token` | string | Configured verify token |

**Response**: `200 OK` (plain text)
```
<hub.challenge value>
```

**Error**: `403 Forbidden` (verify token mismatch)

---

### `POST /api/v1/webhooks/meta`
Meta webhook event receiver.

**Auth**: X-Hub-Signature-256 header ile doğrulama  
**Rate Limit**: 1000 req/min per IP

**Request Headers**:
```http
X-Hub-Signature-256: sha256=<signature>
Content-Type: application/json
```

**Request Body** (örnek Instagram comment event):
```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "instagram_account_id",
      "time": 1642252800,
      "changes": [
        {
          "field": "comments",
          "value": {
            "media_id": "media_123",
            "comment_id": "comment_456",
            "text": "Harika haber!"
          }
        }
      ]
    }
  ]
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "received": true,
    "eventId": "webhook_event_001"
  },
  "requestId": "req_webhook",
  "timestamp": "2024-01-15T12:45:00Z"
}
```

**İşleme Akışı**:
1. Signature doğrulaması (X-Hub-Signature-256)
2. Event `webhook_events` tablosuna kaydedilir
3. Async worker tarafından işlenir (BullMQ)
4. Duplicate event kontrolü (payload hash)

---

## Internal Service Endpoints

### `POST /api/v1/internal/rss/ingest`
RSS Fetcher servisinin ham veriyi API'ye göndermesi.

**Auth**: X-Internal-API-Key header  
**Rate Limit**: 1000 req/min per service

**Request**:
```json
{
  "sourceId": "source-001",
  "items": [
    {
      "sourceUrl": "https://xronos.gr/article/12345",
      "title": "Τροχαίο ατύχημα στην Κομοτηνή",
      "content": "Πρωτότυπο κείμενο...",
      "description": "Περιγραφή...",
      "author": "Δημοσιογράφος",
      "publishedAt": "2024-01-15T08:00:00Z",
      "imageUrl": "https://xronos.gr/images/12345.jpg",
      "metadata": {}
    }
  ]
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "totalItems": 15,
    "newItems": 3,
    "duplicateItems": 12,
    "rawArticleIds": ["raw-001", "raw-002", "raw-003"]
  },
  "requestId": "req_ingest",
  "timestamp": "2024-01-15T13:00:00Z"
}
```

---

### `POST /api/v1/internal/ai/classify`
AI Worker'ın classification sonucunu kaydetmesi.

**Auth**: X-Internal-API-Key header  
**Rate Limit**: 1000 req/min per service

**Request**:
```json
{
  "rawArticleId": "raw-001",
  "classification": {
    "category": "son-dakika",
    "location": "Gümülcine",
    "confidence": 0.95,
    "shouldFilter": false
  }
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "articleId": "article-001",
    "status": "classified",
    "nextStage": "rewrite"
  },
  "requestId": "req_classify",
  "timestamp": "2024-01-15T13:05:00Z"
}
```

---

### `POST /api/v1/internal/ai/rewrite`
AI Worker'ın rewrite sonucunu kaydetmesi.

**Auth**: X-Internal-API-Key header  
**Rate Limit**: 1000 req/min per service

**Request**:
```json
{
  "articleId": "article-001",
  "rewrite": {
    "title": "🔴 SON DAKIKA: Gümülcine'de Trafik Kazası",
    "content": "<p>Türkçe içerik...</p>",
    "summary": "Özet...",
    "socialText": "Sosyal medya metni",
    "hashtags": ["Gümülcine", "TrafikKazası"]
  }
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "articleId": "article-001",
    "status": "rewritten",
    "nextStage": "moderation_or_publish"
  },
  "requestId": "req_rewrite",
  "timestamp": "2024-01-15T13:10:00Z"
}
```

---

### `POST /api/v1/internal/social/dispatch`
Publisher servisinin sosyal medya yayın sonucunu kaydetmesi.

**Auth**: X-Internal-API-Key header  
**Rate Limit**: 1000 req/min per service

**Request**:
```json
{
  "socialPostId": "post-001",
  "status": "published",
  "platformPostId": "instagram_post_123456",
  "platformUrl": "https://instagram.com/p/ABC123/",
  "publishedAt": "2024-01-15T13:15:00Z"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "socialPostId": "post-001",
    "status": "published"
  },
  "requestId": "req_social_dispatch",
  "timestamp": "2024-01-15T13:15:00Z"
}
```

---

## Webhook Tasarımı

### Meta Webhook Verification Flow
1. **Handshake (GET request)**:
   - Meta sends: `GET /api/v1/webhooks/meta?hub.mode=subscribe&hub.challenge=<random>&hub.verify_token=<token>`
   - Server validates `hub.verify_token` matches `META_WEBHOOK_VERIFY_TOKEN`
   - Server responds with `hub.challenge` value (plain text)

2. **Event Reception (POST request)**:
   - Meta sends event payload with `X-Hub-Signature-256` header
   - Server validates signature:
     ```typescript
     const expectedSignature = crypto
       .createHmac('sha256', META_APP_SECRET)
       .update(rawBody)
       .digest('hex');
     const isValid = crypto.timingSafeEqual(
       Buffer.from(`sha256=${expectedSignature}`),
       Buffer.from(signatureHeader)
     );
     ```
   - Server persists event to `webhook_events` table
   - Server responds `200 OK` immediately (async processing)

3. **Async Processing**:
   - BullMQ worker picks up event
   - Duplicate check (payload hash)
   - Business logic execution (örn: comment notification)
   - Mark event as processed

### Duplicate Event Protection
- Event payload'dan SHA256 hash oluşturulur
- `webhook_events` tablosunda hash kontrolü (unique constraint veya query)
- Duplicate ise skip, yeni ise process

---

## Güvenlik ve Gözlemlenebilirlik

### Input Validation
- **Zod schema validation**: Tüm request body'ler için type-safe validation
- **SQL injection prevention**: Prisma ORM kullanımı (parametrized queries)
- **XSS prevention**: Output encoding, Content-Security-Policy header
- **File upload validation**: MIME type, size limit, malware scan (future)

### Structured Logging
Her request için log alanları:
- `requestId`: Unique request identifier (UUID)
- `userId`: Authenticated user ID (varsa)
- `method`: HTTP method
- `path`: Request path
- `statusCode`: Response status
- `duration`: Request duration (ms)
- `userAgent`: Client user agent
- `ip`: Client IP (anonymized last octet)
- `error`: Error details (hata durumunda)

**Log Format** (JSON):
```json
{
  "timestamp": "2024-01-15T13:20:00.123Z",
  "level": "info",
  "requestId": "req_abc123",
  "userId": "user-001",
  "method": "POST",
  "path": "/api/v1/admin/articles/article-001/publish",
  "statusCode": 200,
  "duration": 245,
  "ip": "192.168.1.0",
  "userAgent": "Mozilla/5.0...",
  "message": "Article published successfully"
}
```

### Request Correlation ID
- Her request için unique `requestId` oluşturulur
- Response'da `requestId` field'ında döner
- Tüm log'larda ve downstream service call'larında propagate edilir
- Hata tracking ve debugging için kritik

### Audit Logging
Önemli işlemler için audit log:
- User login/logout
- Article publish/unpublish
- RSS source add/delete
- System setting değişiklikleri
- Social media account bağlama

Audit log tablosu (future Phase 2):
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100),  -- 'article.publish', 'user.login', etc
  entity_type VARCHAR(50),
  entity_id UUID,
  changes JSONB,  -- Before/after values
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

### Secret Handling
- **Environment variables**: API keys, database credentials
- **Encryption at rest**: `social_accounts.access_token` encrypted (AES-256)
- **Secrets rotation**: Quarterly API key rotation policy
- **No secrets in logs**: Sensitive data redaction

### SSRF Prevention
- RSS fetch URL whitelist (domain bazlı)
- Internal network CIDR block blacklist
- Timeout ve max redirect limit
- User-Agent spoofing kontrolü

### Webhook Spoofing Prevention
- Signature validation (HMAC-SHA256)
- Timing-safe comparison
- IP whitelist (Meta IP ranges, opsiyonel)
- Rate limiting

---

## Referanslar

- **Mimari Dokümantasyon**: `ARCHITECTURE/ARCHITECTURE.md`
- **Veri Modeli**: `ARCHITECTURE/DATABASE.md`
- **Next.js API Routes**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- **NextAuth.js**: https://next-auth.js.org
- **Meta Graph API**: https://developers.facebook.com/docs/graph-api
- **Meta Webhooks**: https://developers.facebook.com/docs/graph-api/webhooks
- **OpenAPI Spec** (future): API dokümantasyonu için OpenAPI 3.0 spec oluşturulabilir

import { prisma } from "@trakyahaber/database";
import type { PublicationStatus, Prisma } from "@prisma/client";

// ------------------------------------------------------------------
// Type helpers
// ------------------------------------------------------------------
export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  description: string | null;
  severity: string;
  _count?: { articles: number };
};

export type ArticleListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  location: string | null;
  publishedAt: Date | null;
  viewsCount: number;
  sharesCount: number;
  category: {
    id: string;
    name: string;
    slug: string;
    emoji: string;
    severity: string;
  };
};

export type ArticleDetail = ArticleListItem & {
  content: string;
  author: string | null;
  originalUrl: string;
  hashtags: string[];
  source: { name: string; websiteUrl: string | null };
};

// ------------------------------------------------------------------
// Severity → Tailwind color class map
// ------------------------------------------------------------------
export function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-600 text-white";
    case "high":
      return "bg-yellow-500 text-black";
    case "medium":
      return "bg-green-500 text-white";
    case "low":
      return "bg-blue-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
}

// ------------------------------------------------------------------
// Site constants
// ------------------------------------------------------------------
export const SITE_NAME = "TrakyaHaber";
export const SITE_DESCRIPTION =
  "Batı Trakya'dan son dakika haberler, duyurular ve gelişmeler.";
export const SITE_URL =
  process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://trakyahaber.com";
export const ISR_REVALIDATE = 60; // seconds

// Published filter
const PUBLISHED_FILTER = {
  publicationStatus: "published" as PublicationStatus,
} as const;

// Prisma select objects
const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  emoji: true,
  severity: true,
} as const satisfies Prisma.CategorySelect;

const ARTICLE_LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  imageUrl: true,
  location: true,
  publishedAt: true,
  viewsCount: true,
  sharesCount: true,
  category: { select: CATEGORY_SELECT },
} as const satisfies Prisma.ArticleSelect;

const ARTICLE_DETAIL_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  imageUrl: true,
  location: true,
  publishedAt: true,
  viewsCount: true,
  sharesCount: true,
  content: true,
  author: true,
  originalUrl: true,
  hashtags: true,
  category: { select: CATEGORY_SELECT },
  source: { select: { name: true, websiteUrl: true } },
} as const satisfies Prisma.ArticleSelect;

type ArticleListRow = Prisma.ArticleGetPayload<{
  select: typeof ARTICLE_LIST_SELECT;
}>;

type ArticleDetailRow = Prisma.ArticleGetPayload<{
  select: typeof ARTICLE_DETAIL_SELECT;
}>;

// ------------------------------------------------------------------
// Row mappers
// ------------------------------------------------------------------
function mapListRow(row: ArticleListRow): ArticleListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    imageUrl: row.imageUrl,
    location: row.location,
    publishedAt: row.publishedAt,
    viewsCount: row.viewsCount,
    sharesCount: row.sharesCount,
    category: {
      id: row.category.id,
      name: row.category.name,
      slug: row.category.slug,
      emoji: row.category.emoji,
      severity: row.category.severity,
    },
  };
}

function mapDetailRow(row: ArticleDetailRow): ArticleDetail {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    imageUrl: row.imageUrl,
    location: row.location,
    publishedAt: row.publishedAt,
    viewsCount: row.viewsCount,
    sharesCount: row.sharesCount,
    content: row.content,
    author: row.author,
    originalUrl: row.originalUrl,
    hashtags: [...row.hashtags],
    category: {
      id: row.category.id,
      name: row.category.name,
      slug: row.category.slug,
      emoji: row.category.emoji,
      severity: row.category.severity,
    },
    source: {
      name: row.source.name,
      websiteUrl: row.source.websiteUrl,
    },
  };
}

// ------------------------------------------------------------------
// Data queries
// ------------------------------------------------------------------

export async function getCategories(): Promise<PublicCategory[]> {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      emoji: true,
      description: true,
      severity: true,
      _count: { select: { articles: { where: PUBLISHED_FILTER } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    emoji: r.emoji,
    description: r.description,
    severity: r.severity,
    _count: { articles: r._count.articles },
  }));
}

export async function getCategoryBySlug(
  slug: string
): Promise<PublicCategory | null> {
  const row = await prisma.category.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      emoji: true,
      description: true,
      severity: true,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    emoji: row.emoji,
    description: row.description,
    severity: row.severity,
  };
}

export async function getLatestArticles(
  limit = 20,
  categorySlug?: string
): Promise<ArticleListItem[]> {
  const rows = await prisma.article.findMany({
    where: {
      ...PUBLISHED_FILTER,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: ARTICLE_LIST_SELECT,
  });
  return rows.map(mapListRow);
}

export async function getArticlesWithCursor(opts: {
  categorySlug?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ articles: ArticleListItem[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 20;
  const rows = await prisma.article.findMany({
    where: {
      ...PUBLISHED_FILTER,
      ...(opts.categorySlug
        ? { category: { slug: opts.categorySlug } }
        : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: ARTICLE_LIST_SELECT,
  });

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.id : null;
  return { articles: data.map(mapListRow), nextCursor };
}

export async function getArticleBySlug(
  slug: string
): Promise<ArticleDetail | null> {
  const row = await prisma.article.findFirst({
    where: { slug, ...PUBLISHED_FILTER },
    select: ARTICLE_DETAIL_SELECT,
  });
  if (!row) return null;
  return mapDetailRow(row);
}

export async function getRelatedArticles(
  categoryId: string,
  excludeSlug: string,
  limit = 4
): Promise<ArticleListItem[]> {
  const rows = await prisma.article.findMany({
    where: {
      ...PUBLISHED_FILTER,
      categoryId,
      NOT: { slug: excludeSlug },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: ARTICLE_LIST_SELECT,
  });
  return rows.map(mapListRow);
}

export async function searchArticles(opts: {
  q: string;
  categorySlug?: string;
  limit?: number;
}): Promise<ArticleListItem[]> {
  const limit = Math.min(opts.limit ?? 20, 50);
  const term = opts.q.trim();
  if (term.length === 0) return [];

  const rows = await prisma.article.findMany({
    where: {
      ...PUBLISHED_FILTER,
      ...(opts.categorySlug
        ? { category: { slug: opts.categorySlug } }
        : {}),
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { summary: { contains: term, mode: "insensitive" } },
        { content: { contains: term, mode: "insensitive" } },
      ],
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: ARTICLE_LIST_SELECT,
  });
  return rows.map(mapListRow);
}

export async function getAllPublishedSlugs(): Promise<
  { slug: string; category: { slug: string } }[]
> {
  return prisma.article.findMany({
    where: PUBLISHED_FILTER,
    select: { slug: true, category: { select: { slug: true } } },
    orderBy: { publishedAt: "desc" },
    take: 1000,
  });
}

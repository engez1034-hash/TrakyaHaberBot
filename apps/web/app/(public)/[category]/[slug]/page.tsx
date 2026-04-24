import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArticleCard } from "../../../../components/ArticleCard";
import {
  getArticleBySlug,
  getRelatedArticles,
  getAllPublishedSlugs,
  SITE_NAME,
  SITE_URL,
  ISR_REVALIDATE,
  severityBadgeClass,
} from "../../../../lib/public-data";

export const revalidate = ISR_REVALIDATE;

type Props = { params: { category: string; slug: string } };

export async function generateStaticParams() {
  const slugs = await getAllPublishedSlugs();
  return slugs.map((s) => ({
    category: s.category.slug,
    slug: s.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug);
  if (!article) return { title: "Haber Bulunamadı" };

  const url = `${SITE_URL}/${article.category.slug}/${article.slug}`;
  const description = article.summary ?? article.title;

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      url,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      section: article.category.name,
      ...(article.imageUrl ? { images: [{ url: article.imageUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      ...(article.imageUrl ? { images: [article.imageUrl] } : {}),
    },
    alternates: { canonical: url },
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  const article = await getArticleBySlug(params.slug);

  if (!article) notFound();

  // If category slug mismatch, 404 for clean URLs
  if (article.category.slug !== params.category) notFound();

  const related = await getRelatedArticles(
    article.category.id,
    article.slug,
    4
  );

  const badgeClass = severityBadgeClass(article.category.severity);
  const publishDate = article.publishedAt
    ? new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(article.publishedAt))
    : null;

  const publishIso = article.publishedAt?.toISOString();

  // JSON-LD structured data (NewsArticle)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.summary ?? article.title,
    url: `${SITE_URL}/${article.category.slug}/${article.slug}`,
    datePublished: publishIso,
    dateModified: publishIso,
    ...(article.imageUrl
      ? {
          image: {
            "@type": "ImageObject",
            url: article.imageUrl,
          },
        }
      : {}),
    author: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
    articleSection: article.category.name,
    keywords: article.hashtags.join(", "),
    ...(article.location ? { contentLocation: { "@type": "Place", name: article.location } } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <ol className="flex items-center gap-1 flex-wrap">
            <li>
              <Link href="/" className="hover:text-red-600 transition-colors">
                Ana Sayfa
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href={`/${article.category.slug}`}
                className="hover:text-red-600 transition-colors"
              >
                {article.category.name}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li
              aria-current="page"
              className="font-medium text-gray-900 truncate max-w-xs"
            >
              {article.title}
            </li>
          </ol>
        </nav>

        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Main content */}
          <article className="lg:col-span-2">
            {/* Category badge */}
            <div className="mb-3">
              <Link href={`/${article.category.slug}`}>
                <span
                  className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${badgeClass}`}
                >
                  {article.category.emoji} {article.category.name}
                </span>
              </Link>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight mb-4">
              {article.title}
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mb-6">
              {article.location && (
                <span className="flex items-center gap-1">
                  📍 {article.location}
                </span>
              )}
              {publishDate && (
                <time dateTime={publishIso} className="flex items-center gap-1">
                  🕐 {publishDate}
                </time>
              )}
              {article.author && (
                <span className="flex items-center gap-1">
                  ✍️ {article.author}
                </span>
              )}
              <span className="flex items-center gap-1">
                👁️ {article.viewsCount.toLocaleString("tr-TR")}
              </span>
            </div>

            {/* Hero image */}
            {article.imageUrl && (
              <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-6 bg-gray-100">
                <Image
                  src={article.imageUrl}
                  alt={article.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 800px"
                  priority
                />
              </div>
            )}

            {/* Summary */}
            {article.summary && (
              <p className="text-lg text-gray-700 font-medium border-l-4 border-red-500 pl-4 mb-6 italic">
                {article.summary}
              </p>
            )}

            {/* Content */}
            <div
              className="prose max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            {/* Hashtags */}
            {article.hashtags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {article.hashtags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/search?q=${encodeURIComponent(tag)}`}
                    className="inline-block text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full hover:bg-red-100 hover:text-red-700 transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            {/* Source attribution */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Kaynak:{" "}
                {article.source.websiteUrl ? (
                  <a
                    href={article.source.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {article.source.name}
                  </a>
                ) : (
                  article.source.name
                )}
                {" · "}
                <a
                  href={article.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-blue-600 hover:underline"
                >
                  Orijinal Haber
                </a>
              </p>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="mt-10 lg:mt-0">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sticky top-20">
              <h2 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                📌 İlgili Haberler
              </h2>
              {related.length > 0 ? (
                <div>
                  {related.map((rel) => (
                    <ArticleCard key={rel.id} article={rel} variant="compact" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  İlgili haber bulunamadı.
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link
                  href={`/${article.category.slug}`}
                  className={`block text-center text-sm font-bold px-4 py-2 rounded-full ${badgeClass} hover:opacity-90 transition-opacity`}
                >
                  {article.category.emoji} {article.category.name} Haberleri
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

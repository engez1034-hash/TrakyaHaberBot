import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "../../components/ArticleCard";
import {
  getCategories,
  getLatestArticles,
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_URL,
  ISR_REVALIDATE,
  severityBadgeClass,
} from "../../lib/public-data";

export const revalidate = ISR_REVALIDATE;

export const metadata: Metadata = {
  title: `${SITE_NAME} - Batı Trakya Haberleri`,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: `${SITE_NAME} - Batı Trakya Haberleri`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    type: "website",
  },
  alternates: { canonical: SITE_URL },
};

export default async function PublicHomePage() {
  const [categories, allArticles] = await Promise.all([
    getCategories(),
    getLatestArticles(40),
  ]);

  const featured = allArticles[0];
  const recentArticles = allArticles.slice(1, 7);
  const remainingArticles = allArticles.slice(7);

  // Group remaining by category for section display
  const categoryMap = new Map<string, typeof allArticles>();
  for (const article of remainingArticles) {
    const key = article.category.slug;
    const arr = categoryMap.get(key) ?? [];
    arr.push(article);
    categoryMap.set(key, arr);
  }

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10">
        {/* Breaking news ticker (category badges) */}
        <section aria-label="Kategoriler" className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/${cat.slug}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity ${severityBadgeClass(cat.severity)}`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.name}</span>
              {cat._count !== undefined && (
                <span className="ml-1 opacity-75 text-xs">
                  ({cat._count.articles})
                </span>
              )}
            </Link>
          ))}
        </section>

        {/* Featured hero article */}
        {featured && (
          <section aria-label="Öne çıkan haber">
            <ArticleCard article={featured} variant="featured" />
          </section>
        )}

        {/* Recent articles grid */}
        {recentArticles.length > 0 && (
          <section aria-labelledby="recent-heading">
            <div className="flex items-center justify-between mb-4">
              <h2
                id="recent-heading"
                className="text-xl font-bold text-gray-900 flex items-center gap-2"
              >
                🕐 Son Haberler
              </h2>
              <Link
                href="/search"
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Tümünü gör →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </section>
        )}

        {/* Category sections */}
        {categories.map((cat) => {
          const catArticles = categoryMap.get(cat.slug);
          if (!catArticles || catArticles.length === 0) return null;

          const badgeClass = severityBadgeClass(cat.severity);

          return (
            <section key={cat.id} aria-labelledby={`cat-${cat.slug}`}>
              <div className="flex items-center justify-between mb-4">
                <Link
                  href={`/${cat.slug}`}
                  className="flex items-center gap-2 group"
                >
                  <span
                    id={`cat-${cat.slug}`}
                    className={`px-3 py-1 rounded-lg text-sm font-bold ${badgeClass}`}
                  >
                    {cat.emoji} {cat.name}
                  </span>
                </Link>
                <Link
                  href={`/${cat.slug}`}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Tümü →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {catArticles.slice(0, 4).map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          );
        })}

        {allArticles.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">📰</p>
            <p className="text-lg font-medium">Henüz haber bulunmuyor</p>
            <p className="text-sm mt-1">Yakında haberler yayınlanacak.</p>
          </div>
        )}
      </div>
    </>
  );
}

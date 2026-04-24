import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArticleCard } from "../../../components/ArticleCard";
import {
  searchArticles,
  getCategories,
  SITE_NAME,
  SITE_URL,
} from "../../../lib/public-data";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string | string[]; category?: string | string[] };
type Props = {
  searchParams: SearchParams;
};

function getParam(p: string | string[] | undefined): string {
  return Array.isArray(p) ? (p[0] ?? "") : (p ?? "");
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = getParam(searchParams.q).trim();
  const title = q ? `"${q}" için arama sonuçları` : "Haberlerde Ara";
  return {
    title,
    description: `${SITE_NAME} - ${title}`,
    robots: { index: false, follow: true },
    alternates: { canonical: `${SITE_URL}/search` },
  };
}

async function SearchResults({
  q,
  categorySlug,
}: {
  q: string;
  categorySlug?: string;
}) {
  if (q.trim().length < 2) {
    return (
      <p className="text-gray-500 text-sm">
        Arama yapmak için en az 2 karakter girin.
      </p>
    );
  }

  const results = await searchArticles({ q, categorySlug, limit: 30 });

  if (results.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-4xl mb-4">🔍</p>
        <p className="text-lg font-medium">Sonuç bulunamadı</p>
        <p className="text-sm mt-1">
          &quot;{q}&quot; için haber bulunamadı. Farklı bir arama terimi deneyin.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-gray-500 mb-4">
        <strong className="text-gray-900">{results.length}</strong> sonuç
        bulundu
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const q = getParam(searchParams.q).trim();
  const categorySlug = getParam(searchParams.category) || undefined;
  const categories = await getCategories();

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SearchResultsPage",
    name: `Arama: ${q || ""}`,
    url: `${SITE_URL}/search${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
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
          <ol className="flex items-center gap-1">
            <li>
              <Link href="/" className="hover:text-red-600 transition-colors">
                Ana Sayfa
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-gray-900">
              Arama
            </li>
          </ol>
        </nav>

        {/* Search form */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            🔍 Haberlerde Ara
          </h1>
          <form method="GET" action="/search" className="space-y-3">
            <div className="flex gap-2">
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Arama terimi girin..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoFocus={!q}
              />
              <button
                type="submit"
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors text-sm"
              >
                Ara
              </button>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
              <Link
                href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !categorySlug
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Tümü
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={
                    q
                      ? `/search?q=${encodeURIComponent(q)}&category=${cat.slug}`
                      : `/search?category=${cat.slug}`
                  }
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    categorySlug === cat.slug
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cat.emoji} {cat.name}
                </Link>
              ))}
            </div>
          </form>
        </header>

        {/* Results */}
        {q ? (
          <section aria-label="Arama sonuçları">
            {q.length >= 2 ? (
              <Suspense
                fallback={
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-gray-100 rounded-xl h-64 animate-pulse"
                      />
                    ))}
                  </div>
                }
              >
                <SearchResults q={q} categorySlug={categorySlug} />
              </Suspense>
            ) : (
              <p className="text-gray-500 text-sm">
                Arama yapmak için en az 2 karakter girin.
              </p>
            )}
          </section>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-4">📰</p>
            <p className="text-base font-medium">Arama yapmaya başlayın</p>
            <p className="text-sm mt-1">
              Başlık veya içeriğe göre haberler arasında arama yapabilirsiniz.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

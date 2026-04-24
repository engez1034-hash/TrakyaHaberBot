import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArticleCard } from "../../../components/ArticleCard";
import {
  getCategoryBySlug,
  getLatestArticles,
  getCategories,
  SITE_NAME,
  SITE_URL,
  ISR_REVALIDATE,
  severityBadgeClass,
} from "../../../lib/public-data";

export const revalidate = ISR_REVALIDATE;

type Props = { params: { category: string } };

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = await getCategoryBySlug(params.category);
  if (!cat) return { title: "Kategori Bulunamadı" };

  const title = `${cat.emoji} ${cat.name} Haberleri`;
  const description =
    cat.description ??
    `${cat.name} kategorisindeki son haberler – ${SITE_NAME}`;
  const url = `${SITE_URL}/${cat.slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    alternates: { canonical: url },
  };
}

export default async function CategoryPage({ params }: Props) {
  const [cat, articles] = await Promise.all([
    getCategoryBySlug(params.category),
    getLatestArticles(24, params.category),
  ]);

  if (!cat) notFound();

  const badgeClass = severityBadgeClass(cat.severity);
  const featured = articles[0];
  const gridArticles = articles.slice(1);

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${cat.emoji} ${cat.name} Haberleri`,
    description:
      cat.description ?? `${cat.name} kategorisindeki son haberler`,
    url: `${SITE_URL}/${cat.slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
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
              {cat.name}
            </li>
          </ol>
        </nav>

        {/* Category header */}
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-2 rounded-xl text-base font-bold ${badgeClass}`}
            >
              {cat.emoji} {cat.name}
            </span>
          </div>
          {cat.description && (
            <p className="mt-2 text-gray-600 text-sm max-w-2xl">
              {cat.description}
            </p>
          )}
        </header>

        {articles.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">{cat.emoji}</p>
            <p className="text-lg font-medium">
              Bu kategoride henüz haber bulunmuyor
            </p>
          </div>
        )}

        {/* Featured */}
        {featured && (
          <section aria-label="Öne çıkan haber" className="mb-8">
            <ArticleCard article={featured} variant="featured" />
          </section>
        )}

        {/* Grid */}
        {gridArticles.length > 0 && (
          <section
            aria-label={`${cat.name} haberleri listesi`}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {gridArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </section>
        )}

        {/* Load more hint */}
        {articles.length >= 24 && (
          <div className="mt-10 text-center">
            <Link
              href={`/search?category=${cat.slug}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 transition-colors"
            >
              Daha Fazla Haber
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

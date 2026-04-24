import Link from "next/link";
import Image from "next/image";
import type { ArticleListItem } from "../lib/public-data";
import { severityBadgeClass } from "../lib/public-data";

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

type Props = {
  article: ArticleListItem;
  variant?: "default" | "featured" | "compact";
};

export function ArticleCard({ article, variant = "default" }: Props) {
  const href = `/${article.category.slug}/${article.slug}`;
  const badgeClass = severityBadgeClass(article.category.severity);

  if (variant === "featured") {
    return (
      <Link
        href={href}
        className="group relative block rounded-xl overflow-hidden bg-gray-900 aspect-[16/9] sm:aspect-[2/1]"
      >
        {article.imageUrl ? (
          <Image
            src={article.imageUrl}
            alt={article.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <span
            className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full mb-2 ${badgeClass}`}
          >
            {article.category.emoji} {article.category.name}
          </span>
          <h2 className="text-white font-bold text-lg sm:text-2xl leading-tight line-clamp-2 group-hover:text-red-300 transition-colors">
            {article.title}
          </h2>
          {article.summary && (
            <p className="text-gray-300 text-sm mt-1 line-clamp-2 hidden sm:block">
              {article.summary}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-gray-400 text-xs">
            {article.location && <span>📍 {article.location}</span>}
            <span>{formatDate(article.publishedAt)}</span>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link
        href={href}
        className="group flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
      >
        {article.imageUrl && (
          <div className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-200">
            <Image
              src={article.imageUrl}
              alt={article.title}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span
            className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded mb-1 ${badgeClass}`}
          >
            {article.category.emoji}
          </span>
          <p className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-red-600 transition-colors">
            {article.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(article.publishedAt)}
          </p>
        </div>
      </Link>
    );
  }

  // default card
  return (
    <Link
      href={href}
      className="group block bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
        {article.imageUrl ? (
          <Image
            src={article.imageUrl}
            alt={article.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <span className="text-4xl">{article.category.emoji}</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span
            className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${badgeClass}`}
          >
            {article.category.emoji} {article.category.name}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-red-600 transition-colors leading-snug">
          {article.title}
        </h3>
        {article.summary && (
          <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">
            {article.summary}
          </p>
        )}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            {article.location && <span>📍 {article.location}</span>}
          </div>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

import Link from "next/link";
import type { PublicCategory } from "../lib/public-data";
import { severityBadgeClass, SITE_NAME } from "../lib/public-data";

type Props = { categories: PublicCategory[] };

export function PublicHeader({ categories }: Props) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between h-14">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl text-red-600 hover:text-red-700 transition-colors"
          >
            <span className="text-2xl">📰</span>
            <span>{SITE_NAME}</span>
          </Link>

          {/* Search */}
          <form
            action="/search"
            method="GET"
            className="hidden sm:flex items-center"
          >
            <div className="relative">
              <input
                type="search"
                name="q"
                placeholder="Haberlerde ara..."
                className="pl-4 pr-10 py-1.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent w-56 lg:w-72"
              />
              <button
                type="submit"
                aria-label="Ara"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>

        {/* Category nav */}
        <nav
          className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
          aria-label="Kategoriler"
        >
          <Link
            href="/"
            className="flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-red-600 hover:text-white transition-colors"
          >
            Tümü
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/${cat.slug}`}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors hover:opacity-90 ${severityBadgeClass(cat.severity)}`}
            >
              <span className="mr-1">{cat.emoji}</span>
              {cat.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile search bar */}
      <div className="sm:hidden border-t border-gray-100 px-4 py-2">
        <form action="/search" method="GET" className="flex items-center">
          <input
            type="search"
            name="q"
            placeholder="Haberlerde ara..."
            className="flex-1 pl-4 pr-4 py-1.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            type="submit"
            className="ml-2 px-3 py-1.5 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Ara
          </button>
        </form>
      </div>
    </header>
  );
}

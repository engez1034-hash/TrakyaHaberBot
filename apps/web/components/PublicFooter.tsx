import Link from "next/link";
import { SITE_NAME } from "../lib/public-data";

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-gray-900 text-gray-400 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="font-bold text-lg text-white hover:text-red-400 transition-colors"
            >
              📰 {SITE_NAME}
            </Link>
            <p className="mt-1 text-sm">
              Batı Trakya&apos;dan son dakika haberler
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link href="/" className="hover:text-white transition-colors">
              Ana Sayfa
            </Link>
            <Link
              href="/search"
              className="hover:text-white transition-colors"
            >
              Arama
            </Link>
          </nav>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-800 text-center text-xs">
          &copy; {year} {SITE_NAME}. Tüm hakları saklıdır.
        </div>
      </div>
    </footer>
  );
}

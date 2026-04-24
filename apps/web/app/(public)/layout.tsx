import type { ReactNode } from "react";
import type { Metadata } from "next";
import { PublicHeader } from "../../components/PublicHeader";
import { PublicFooter } from "../../components/PublicFooter";
import { getCategories, SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "../../lib/public-data";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "tr_TR",
  },
  twitter: {
    card: "summary_large_image",
    site: "@trakyahaber",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const categories = await getCategories();

  return (
    <>
      <PublicHeader categories={categories} />
      <main className="min-h-screen">{children}</main>
      <PublicFooter />
    </>
  );
}

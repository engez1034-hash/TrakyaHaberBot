import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const nav = [
    ["Dashboard", "/admin/dashboard"],
    ["RSS Kaynakları", "/admin/rss-sources"],
    ["Kategoriler", "/admin/categories"],
    ["Haberler", "/admin/articles"],
    ["Sosyal Medya", "/admin/social"],
    ["Ayarlar", "/admin/settings"]
  ];

  return (
    <AdminGuard>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[240px_1fr]">
          <aside className="rounded-lg border bg-white p-4">
            <h2 className="mb-4 text-lg font-semibold">TrakyaHaber Admin</h2>
            <nav className="space-y-2">
              {nav.map(([label, href]) => (
                <Link className="block rounded px-3 py-2 hover:bg-slate-100" key={href} href={href}>
                  {label}
                </Link>
              ))}
              <Link className="mt-3 block rounded bg-slate-900 px-3 py-2 text-white" href="/logout">
                Çıkış Yap
              </Link>
            </nav>
          </aside>
          <section className="rounded-lg border bg-white p-4">{children}</section>
        </div>
      </div>
    </AdminGuard>
  );
}

async function AdminGuard({ children }: { children: ReactNode }) {
  const session = await getAuthSession();
  if (!session?.user) redirect("/login");
  return <>{children}</>;
}

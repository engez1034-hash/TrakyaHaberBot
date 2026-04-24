import Link from "next/link";
import { prisma } from "@trakyahaber/database";

export default async function AdminRssSourcesPage() {
  const sources = await prisma.rssSource.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">RSS Kaynakları</h1>
        <Link className="rounded bg-slate-900 px-3 py-2 text-white" href="/api/v1/admin/rss-sources">
          API Liste
        </Link>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">İsim</th>
              <th className="px-3 py-2 text-left">URL</th>
              <th className="px-3 py-2 text-left">Durum</th>
              <th className="px-3 py-2 text-left">Son Çekme</th>
              <th className="px-3 py-2 text-left">Hata</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2">{s.url}</td>
                <td className="px-3 py-2">{s.isActive ? "Aktif" : "Pasif"}</td>
                <td className="px-3 py-2">{s.lastFetchedAt ? new Date(s.lastFetchedAt).toLocaleString("tr-TR") : "-"}</td>
                <td className="px-3 py-2">{s.lastFetchError ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

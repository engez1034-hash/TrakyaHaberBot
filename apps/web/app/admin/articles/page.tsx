import { prisma } from "@trakyahaber/database";

export default async function AdminArticlesPage() {
  const articles = await prisma.article.findMany({
    include: { category: true, source: true },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Haber Yönetimi</h1>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">Başlık</th>
              <th className="px-3 py-2 text-left">Kategori</th>
              <th className="px-3 py-2 text-left">Durum</th>
              <th className="px-3 py-2 text-left">Tarih</th>
              <th className="px-3 py-2 text-left">Kaynak</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2">{a.title}</td>
                <td className="px-3 py-2">{a.category.name}</td>
                <td className="px-3 py-2">{a.status}</td>
                <td className="px-3 py-2">{new Date(a.createdAt).toLocaleString("tr-TR")}</td>
                <td className="px-3 py-2">{a.source.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

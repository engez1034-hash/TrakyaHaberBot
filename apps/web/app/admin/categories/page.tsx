import { prisma } from "@trakyahaber/database";

export default async function AdminCategoriesPage() {
  const [categories, rules] = await Promise.all([
    prisma.category.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.locationRule.findMany({ include: { category: true, region: true } })
  ]);

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Kategori Yönetimi</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {categories.map((c) => (
          <div key={c.id} className="rounded border bg-white p-4">
            <div className="flex items-center gap-2">
              <span>{c.emoji}</span>
              <strong>{c.name}</strong>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.severity}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{c.description ?? "-"}</p>
            <p className="mt-1 text-xs">Lokasyon bağımlı: {c.locationDependent ? "Evet" : "Hayır"}</p>
          </div>
        ))}
      </div>
      <div className="rounded border p-4">
        <h2 className="mb-2 font-medium">Lokasyon Kuralları</h2>
        <ul className="space-y-1 text-sm">
          {rules.map((r) => (
            <li key={r.id}>
              {r.category.name} - {r.region.nameTr}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

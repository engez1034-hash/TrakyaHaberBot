import { prisma } from "@trakyahaber/database";

export default async function AdminSettingsPage() {
  const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Ayarlar</h1>
      <div className="rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">Anahtar</th>
              <th className="px-3 py-2 text-left">Değer</th>
              <th className="px-3 py-2 text-left">Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">{s.key}</td>
                <td className="px-3 py-2">{JSON.stringify(s.value)}</td>
                <td className="px-3 py-2">{s.description ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

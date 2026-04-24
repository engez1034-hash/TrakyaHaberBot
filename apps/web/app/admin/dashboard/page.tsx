import { prisma } from "@trakyahaber/database";

export default async function AdminDashboardPage() {
  const [total, pending, socialPending] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: "pending_review" } }),
    prisma.socialPost.count({ where: { status: "pending_approval" } })
  ]);
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card title="Toplam Haber" value={String(total)} />
        <Card title="Bekleyen Onay" value={String(pending)} />
        <Card title="Sosyal Onay Bekleyen" value={String(socialPending)} />
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded border bg-white p-4">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

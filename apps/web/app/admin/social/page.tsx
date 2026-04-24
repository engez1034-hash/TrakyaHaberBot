import { prisma } from "@trakyahaber/database";

export default async function AdminSocialPage() {
  const [accounts, posts] = await Promise.all([
    prisma.socialAccount.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.socialPost.findMany({
      include: { article: true, account: true },
      orderBy: { createdAt: "desc" },
      take: 50
    })
  ]);
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Sosyal Medya</h1>
      <section className="rounded border p-4">
        <h2 className="mb-2 font-medium">Bağlı Hesaplar</h2>
        <ul className="space-y-1 text-sm">
          {accounts.map((a) => (
            <li key={a.id}>
              {a.platform} - {a.platformUsername ?? a.displayName ?? a.platformUserId}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded border p-4">
        <h2 className="mb-2 font-medium">Paylaşım Kuyruğu</h2>
        <ul className="space-y-1 text-sm">
          {posts.map((p) => (
            <li key={p.id}>
              {p.status} - {p.platform} - {p.article.title}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

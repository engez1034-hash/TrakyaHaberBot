import { notFound } from "next/navigation";
import { prisma } from "@trakyahaber/database";

export default async function AdminArticleDetailPage({
  params
}: {
  params: { id: string };
}) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { category: true, source: true }
  });
  if (!article) notFound();

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Haber Detayı</h1>
      <div className="rounded border bg-white p-4">
        <p className="text-sm text-slate-500">Başlık</p>
        <p className="font-medium">{article.title}</p>
        <p className="mt-3 text-sm text-slate-500">İçerik</p>
        <article className="prose max-w-none">{article.content}</article>
        <p className="mt-3 text-sm">
          Kategori: {article.category.name} | Kaynak: {article.source.name} | Durum: {article.status}
        </p>
      </div>
    </main>
  );
}

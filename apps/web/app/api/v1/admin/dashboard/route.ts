import { prisma } from "@trakyahaber/database";
import { ok } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

export async function GET() {
  const auth = await requireApiRole(["editor", "admin", "super_admin", "viewer"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:dashboard:${auth.user.id}`, 300)) {
    return Response.json({ success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Çok fazla istek", statusCode: 429 } }, { status: 429 });
  }

  const [totalArticles, pendingApproval, socialPending, categories] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: "pending_review" } }),
    prisma.socialPost.count({ where: { status: "pending_approval" } }),
    prisma.category.findMany({
      select: { id: true, name: true, articles: { select: { id: true } } }
    })
  ]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayAdded = await prisma.article.count({ where: { createdAt: { gte: startOfDay } } });

  const last7Days = await prisma.article.groupBy({
    by: ["createdAt"],
    _count: { id: true },
    orderBy: { createdAt: "asc" },
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
  });

  return ok({
    totalArticles,
    todayAdded,
    pendingApproval,
    socialStatus: { pendingApproval: socialPending },
    byCategory: categories.map((c) => ({ id: c.id, name: c.name, count: c.articles.length })),
    last7Days: last7Days.map((d) => ({ date: d.createdAt, count: d._count.id })),
    recentErrors: []
  });
}

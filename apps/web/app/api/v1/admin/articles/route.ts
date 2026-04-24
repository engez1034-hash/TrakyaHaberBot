import { prisma } from "@trakyahaber/database";
import { fail, ok } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

export async function GET(req: Request) {
  const auth = await requireApiRole(["viewer", "editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:articles:list:${auth.user.id}`, 300)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
  const cursor = searchParams.get("cursor");
  const q = searchParams.get("q");
  const categoryId = searchParams.get("categoryId");
  const status = searchParams.get("status");
  const publishedAfter = searchParams.get("publishedAfter");
  const publishedBefore = searchParams.get("publishedBefore");

  const where: any = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { content: { contains: q, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(status ? { status } : {}),
    ...(publishedAfter || publishedBefore
      ? {
          createdAt: {
            ...(publishedAfter ? { gte: new Date(publishedAfter) } : {}),
            ...(publishedBefore ? { lte: new Date(publishedBefore) } : {})
          }
        }
      : {})
  };

  const data = await prisma.article.findMany({
    where,
    include: { category: true, source: true },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
  });

  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  return ok(items, {
    meta: { nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null, hasMore, limit }
  });
}

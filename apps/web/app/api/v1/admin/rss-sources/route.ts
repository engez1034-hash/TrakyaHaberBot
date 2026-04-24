import { prisma } from "@trakyahaber/database";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

const createSchema = z.object({
  name: z.string().min(2),
  url: z.string().url(),
  websiteUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  fetchIntervalMinutes: z.number().int().min(1).max(1440).optional()
});

export async function GET(req: Request) {
  const auth = await requireApiRole(["viewer", "editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:rss:list:${auth.user.id}`, 300)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
  const cursor = searchParams.get("cursor");
  const isActiveParam = searchParams.get("isActive");
  const where = isActiveParam == null ? {} : { isActive: isActiveParam === "true" };
  const data = await prisma.rssSource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
  });
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  return ok(items, { meta: { nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null, hasMore, limit } });
}

export async function POST(req: Request) {
  const auth = await requireApiRole(["admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:rss:create:${auth.user.id}`, 60)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Geçersiz veri", parsed.error.flatten());
  try {
    const created = await prisma.rssSource.create({ data: parsed.data });
    return ok(created, { status: 201 });
  } catch {
    return fail(409, "DUPLICATE_RESOURCE", "RSS kaynağı zaten mevcut");
  }
}

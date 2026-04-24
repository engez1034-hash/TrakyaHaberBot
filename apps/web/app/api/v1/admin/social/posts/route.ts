import { prisma } from "@trakyahaber/database";
import { ok, fail } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

export async function GET(req: Request) {
  const auth = await requireApiRole(["viewer", "editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:social:posts:${auth.user.id}`, 300)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const data = await prisma.socialPost.findMany({
    where: status ? { status: status as any } : {},
    include: { article: true, account: true },
    orderBy: { createdAt: "desc" }
  });
  return ok(data);
}

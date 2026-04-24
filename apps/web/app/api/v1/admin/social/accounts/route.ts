import { prisma } from "@trakyahaber/database";
import { ok, fail } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

export async function GET() {
  const auth = await requireApiRole(["viewer", "editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:social:accounts:${auth.user.id}`, 300)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const data = await prisma.socialAccount.findMany({ orderBy: { createdAt: "desc" } });
  return ok(data);
}

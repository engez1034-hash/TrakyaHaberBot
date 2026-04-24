import { prisma } from "@trakyahaber/database";
import { fail, ok } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:location-rules:delete:${auth.user.id}`, 60)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  try {
    await prisma.locationRule.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch {
    return fail(404, "NOT_FOUND", "Kural bulunamadı");
  }
}

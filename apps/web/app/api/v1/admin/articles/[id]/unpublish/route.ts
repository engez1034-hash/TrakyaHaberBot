import { prisma } from "@trakyahaber/database";
import { fail, ok } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:article:unpublish:${auth.user.id}`, 60)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");

  try {
    const updated = await prisma.article.update({
      where: { id: params.id },
      data: { status: "unpublished", publicationStatus: "archived" }
    });
    return ok(updated);
  } catch {
    return fail(404, "NOT_FOUND", "Haber bulunamadı");
  }
}

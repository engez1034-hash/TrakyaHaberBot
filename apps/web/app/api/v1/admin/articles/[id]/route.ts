import { prisma } from "@trakyahaber/database";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

const patchSchema = z.object({
  title: z.string().min(5).optional(),
  content: z.string().min(10).optional(),
  imageUrl: z.string().url().nullable().optional(),
  categoryId: z.string().uuid().optional(),
  summary: z.string().nullable().optional()
});

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["viewer", "editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:article:get:${auth.user.id}`, 300)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const data = await prisma.article.findUnique({
    where: { id: params.id },
    include: { category: true, source: true, revisions: { orderBy: { createdAt: "desc" }, take: 10 } }
  });
  if (!data) return fail(404, "NOT_FOUND", "Haber bulunamadı");
  return ok(data);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:article:patch:${auth.user.id}`, 60)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Geçersiz veri", parsed.error.flatten());
  const article = await prisma.article.findUnique({ where: { id: params.id } });
  if (!article) return fail(404, "NOT_FOUND", "Haber bulunamadı");
  const updated = await prisma.article.update({ where: { id: params.id }, data: parsed.data });
  await prisma.articleRevision.create({
    data: {
      articleId: updated.id,
      title: updated.title,
      content: updated.content,
      changedBy: auth.user.id,
      changeReason: "Admin panel güncellemesi"
    }
  });
  return ok(updated);
}

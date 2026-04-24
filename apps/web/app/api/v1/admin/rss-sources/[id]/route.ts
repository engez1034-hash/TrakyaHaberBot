import { prisma } from "@trakyahaber/database";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  url: z.string().url().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
  fetchIntervalMinutes: z.number().int().min(1).max(1440).optional()
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:rss:update:${auth.user.id}`, 60)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Geçersiz veri", parsed.error.flatten());
  try {
    const updated = await prisma.rssSource.update({ where: { id: params.id }, data: parsed.data });
    return ok(updated);
  } catch {
    return fail(404, "NOT_FOUND", "Kaynak bulunamadı");
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:rss:delete:${auth.user.id}`, 60)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  try {
    await prisma.rssSource.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch {
    return fail(404, "NOT_FOUND", "Kaynak bulunamadı");
  }
}

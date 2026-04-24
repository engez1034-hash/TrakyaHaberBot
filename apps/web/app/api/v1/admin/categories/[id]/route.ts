import { prisma } from "@trakyahaber/database";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  emoji: z.string().min(1).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  locationDependent: z.boolean().optional(),
  description: z.string().nullable().optional(),
  aiClassificationKeywords: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:categories:update:${auth.user.id}`, 60)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Geçersiz veri", parsed.error.flatten());
  try {
    const updated = await prisma.category.update({ where: { id: params.id }, data: parsed.data });
    return ok(updated);
  } catch {
    return fail(404, "NOT_FOUND", "Kategori bulunamadı");
  }
}

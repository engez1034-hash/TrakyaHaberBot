import { prisma } from "@trakyahaber/database";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

const createSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  emoji: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]),
  locationDependent: z.boolean().default(true),
  description: z.string().optional(),
  aiClassificationKeywords: z.array(z.string()).default([]),
  isActive: z.boolean().default(true)
});

export async function GET() {
  const auth = await requireApiRole(["viewer", "editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:categories:list:${auth.user.id}`, 300)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const data = await prisma.category.findMany({ orderBy: { displayOrder: "asc" } });
  return ok(data);
}

export async function POST(req: Request) {
  const auth = await requireApiRole(["admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:categories:create:${auth.user.id}`, 60)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Geçersiz veri", parsed.error.flatten());
  try {
    const created = await prisma.category.create({ data: parsed.data });
    return ok(created, { status: 201 });
  } catch {
    return fail(409, "DUPLICATE_RESOURCE", "Kategori zaten mevcut");
  }
}

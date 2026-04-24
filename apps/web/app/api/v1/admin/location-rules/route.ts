import { prisma } from "@trakyahaber/database";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

const createSchema = z.object({
  categoryId: z.string().uuid(),
  regionId: z.string().uuid(),
  isRequired: z.boolean().default(true)
});

export async function GET() {
  const auth = await requireApiRole(["viewer", "editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:location-rules:list:${auth.user.id}`, 300)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const data = await prisma.locationRule.findMany({ include: { category: true, region: true } });
  return ok(data);
}

export async function POST(req: Request) {
  const auth = await requireApiRole(["admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:location-rules:create:${auth.user.id}`, 60)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Geçersiz veri", parsed.error.flatten());
  try {
    const created = await prisma.locationRule.create({ data: parsed.data });
    return ok(created, { status: 201 });
  } catch {
    return fail(409, "DUPLICATE_RESOURCE", "Kural zaten mevcut");
  }
}

import { prisma } from "@trakyahaber/database";
import { z } from "zod";
import { ok, fail } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

const schema = z.object({
  moderationEnabled: z.boolean(),
  socialApprovalRequired: z.boolean(),
  rssFetchInterval: z.number().int().min(1).max(1440),
  aiClassifyModel: z.string().min(1),
  aiRewriteModel: z.string().min(1),
  featureFlags: z.record(z.any()).default({})
});

const KEYS = {
  moderationEnabled: "moderation.web_publish.enabled",
  socialApprovalRequired: "moderation.social_publish.enabled",
  rssFetchInterval: "rss.default_fetch_interval",
  aiClassifyModel: "ai.classification_model",
  aiRewriteModel: "ai.rewrite_model",
  featureFlags: "features.flags"
} as const;

export async function GET() {
  const auth = await requireApiRole(["viewer", "editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:settings:get:${auth.user.id}`, 300)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.values(KEYS) } }
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return ok({
    moderationEnabled: Boolean(map.get(KEYS.moderationEnabled) ?? false),
    socialApprovalRequired: Boolean(map.get(KEYS.socialApprovalRequired) ?? false),
    rssFetchInterval: Number(map.get(KEYS.rssFetchInterval) ?? 10),
    aiClassifyModel: String(map.get(KEYS.aiClassifyModel) ?? "gpt-4o-mini"),
    aiRewriteModel: String(map.get(KEYS.aiRewriteModel) ?? "gpt-4o"),
    featureFlags: (map.get(KEYS.featureFlags) as Record<string, unknown>) ?? {}
  });
}

export async function PATCH(req: Request) {
  const auth = await requireApiRole(["admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:settings:patch:${auth.user.id}`, 60)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Geçersiz veri", parsed.error.flatten());

  const payload = parsed.data;
  await Promise.all(
    Object.entries({
      [KEYS.moderationEnabled]: payload.moderationEnabled,
      [KEYS.socialApprovalRequired]: payload.socialApprovalRequired,
      [KEYS.rssFetchInterval]: payload.rssFetchInterval,
      [KEYS.aiClassifyModel]: payload.aiClassifyModel,
      [KEYS.aiRewriteModel]: payload.aiRewriteModel,
      [KEYS.featureFlags]: payload.featureFlags
    }).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        create: { key, value, updatedBy: auth.user.id },
        update: { value, updatedBy: auth.user.id }
      })
    )
  );

  return ok({ updated: true });
}

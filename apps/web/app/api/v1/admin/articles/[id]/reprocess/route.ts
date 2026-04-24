import { ok, fail } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";
import { aiClassifyQueue } from "@/lib/queues";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:article:reprocess:${auth.user.id}`, 60)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");

  await aiClassifyQueue.add("reprocess", { rawArticleId: params.id });
  return ok({ queued: true, queue: "ai:classify", id: params.id });
}

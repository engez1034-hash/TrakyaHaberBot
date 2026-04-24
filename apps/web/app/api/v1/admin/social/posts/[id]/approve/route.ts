import { prisma } from "@trakyahaber/database";
import { ok, fail } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";
import { socialPublishQueue } from "@/lib/queues";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["editor", "admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:social:approve:${auth.user.id}`, 60)) {
    return fail(429, "RATE_LIMIT_EXCEEDED", "Cok fazla istek");
  }

  try {
    const updated = await prisma.socialPost.update({
      where: { id: params.id },
      data: { status: "approved", approvedAt: new Date(), approvedBy: auth.user.id }
    });
    const now = Date.now();
    const delay = updated.scheduledFor ? Math.max(0, updated.scheduledFor.getTime() - now) : 0;
    await socialPublishQueue.add(
      "social-publish-approved-post",
      { socialPostId: updated.id },
      {
        delay,
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: 1000,
        removeOnFail: 1000
      }
    );
    return ok(updated);
  } catch {
    return fail(404, "NOT_FOUND", "Paylasim bulunamadi");
  }
}
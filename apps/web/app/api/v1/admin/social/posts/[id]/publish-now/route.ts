import { prisma } from "@trakyahaber/database";
import { ok, fail } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";
import { socialPublishQueue } from "@/lib/queues";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:social:publish-now:${auth.user.id}`, 30)) {
    return fail(429, "RATE_LIMIT_EXCEEDED", "Cok fazla istek");
  }

  try {
    const updated = await prisma.socialPost.update({
      where: { id: params.id },
      data: { status: "pending", scheduledFor: null }
    });
    await socialPublishQueue.add(
      "social-publish-now",
      { socialPostId: updated.id },
      {
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
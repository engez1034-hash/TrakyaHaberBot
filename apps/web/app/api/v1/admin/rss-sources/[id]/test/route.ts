import { prisma } from "@trakyahaber/database";
import { fail, ok } from "@/lib/api";
import { rateLimit, requireApiRole } from "@/lib/admin";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["admin", "super_admin"]);
  if ("error" in auth) return auth.error;
  if (!rateLimit(`admin:rss:test:${auth.user.id}`, 30)) return fail(429, "RATE_LIMIT_EXCEEDED", "Çok fazla istek");
  const src = await prisma.rssSource.findUnique({ where: { id: params.id } });
  if (!src) return fail(404, "NOT_FOUND", "Kaynak bulunamadı");
  try {
    const resp = await fetch(src.url, { method: "GET" });
    const text = await resp.text();
    await prisma.rssSource.update({
      where: { id: src.id },
      data: {
        lastFetchedAt: new Date(),
        lastFetchStatus: resp.ok ? "ok" : "error",
        lastFetchError: resp.ok ? null : `HTTP ${resp.status}`
      }
    });
    return ok({ reachable: resp.ok, status: resp.status, preview: text.slice(0, 200) });
  } catch (e) {
    await prisma.rssSource.update({
      where: { id: src.id },
      data: { lastFetchedAt: new Date(), lastFetchStatus: "error", lastFetchError: String(e) }
    });
    return fail(503, "RSS_TEST_FAILED", "Kaynağa erişilemedi");
  }
}

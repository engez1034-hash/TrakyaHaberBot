import { type NextRequest } from "next/server";
import { ok, fail } from "../../../../lib/api";
import { getArticlesWithCursor } from "../../../../lib/public-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const category = searchParams.get("category") ?? undefined;
    const cursor = searchParams.get("cursor") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

    if (isNaN(limit) || limit < 1) {
      return fail(400, "VALIDATION_ERROR", "limit parametresi geçersiz");
    }

    const { articles, nextCursor } = await getArticlesWithCursor({
      categorySlug: category,
      cursor,
      limit,
    });

    return ok(articles, {
      meta: {
        nextCursor,
        hasMore: nextCursor !== null,
        limit,
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/articles]", err);
    return fail(500, "INTERNAL_ERROR", "Sunucu hatası");
  }
}

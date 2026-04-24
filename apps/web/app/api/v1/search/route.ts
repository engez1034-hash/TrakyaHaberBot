import { type NextRequest } from "next/server";
import { ok, fail } from "../../../../lib/api";
import { searchArticles } from "../../../../lib/public-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q") ?? "";
    const category = searchParams.get("category") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

    if (q.trim().length < 2) {
      return fail(
        400,
        "VALIDATION_ERROR",
        "Arama sorgusu en az 2 karakter olmalıdır"
      );
    }

    const results = await searchArticles({ q, categorySlug: category, limit });
    return ok({ query: q, results, total: results.length });
  } catch (err) {
    console.error("[GET /api/v1/search]", err);
    return fail(500, "INTERNAL_ERROR", "Sunucu hatası");
  }
}

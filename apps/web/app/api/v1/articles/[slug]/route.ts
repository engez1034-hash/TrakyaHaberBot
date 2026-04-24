import { type NextRequest } from "next/server";
import { ok, fail } from "../../../../../lib/api";
import { getArticleBySlug, getRelatedArticles } from "../../../../../lib/public-data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    if (!slug) {
      return fail(400, "VALIDATION_ERROR", "slug parametresi zorunludur");
    }

    const article = await getArticleBySlug(slug);
    if (!article) {
      return fail(404, "NOT_FOUND", "Haber bulunamadı");
    }

    const related = await getRelatedArticles(
      article.category.id,
      article.slug,
      4
    );

    return ok({ ...article, relatedArticles: related });
  } catch (err) {
    console.error("[GET /api/v1/articles/[slug]]", err);
    return fail(500, "INTERNAL_ERROR", "Sunucu hatası");
  }
}

import { ok, fail } from "../../../../lib/api";
import { getCategories } from "../../../../lib/public-data";

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const categories = await getCategories();
    return ok(
      categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        emoji: cat.emoji,
        description: cat.description,
        severity: cat.severity,
        articleCount: cat._count?.articles ?? 0,
      }))
    );
  } catch (err) {
    console.error("[GET /api/v1/categories]", err);
    return fail(500, "INTERNAL_ERROR", "Sunucu hatası");
  }
}

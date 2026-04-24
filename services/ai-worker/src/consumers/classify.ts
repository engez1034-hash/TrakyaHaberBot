import { prisma } from "@trakyahaber/database";
import { logger } from "@trakyahaber/logger";
import { callModelText } from "../llm/openai.js";
import { getPromptTemplate, interpolateTemplate } from "../llm/prompts.js";
import type { ClassificationResult } from "../types.js";

const DEFAULT_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "son-dakika":
    "SON DAKIKA - Alarm etkisi yaratan acil haberler (kaza, yangin, dogal afet, operasyon, patlama). Toplumu aninda etkileyen olaylar.",
  duyuru:
    "DUYURU - Resmi uyarilar ve bilgilendirmeler (kesinti, yol kapama, son basvuru tarihi). Vatandasi harekete geciren duyurular.",
  "odeme-haberi":
    "ODEME HABERI - Para ve destek haberleri (maas, cocuk parasi, hibe, odeme). Vatandasin cebini ilgilendiren haberler.",
  "genel-bilgi":
    "GENEL BILGI - Kamu hizmetleri ve yerel duzenlemeler (belediye, kamu faaliyetleri). Bilgi niteligi tasiyan haberler."
};

const parseClassification = (text: string): ClassificationResult => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const target = jsonMatch ? jsonMatch[0] : text;
    const parsed = JSON.parse(target) as Partial<ClassificationResult>;
    if (!parsed.categorySlug || typeof parsed.confidence !== "number" || !parsed.reasoning) {
      throw new Error("invalid classification payload");
    }
    return {
      categorySlug: parsed.categorySlug,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      reasoning: parsed.reasoning,
      detectedLocation: parsed.detectedLocation ?? null
    };
  } catch (_error) {
    return {
      categorySlug: "genel-bilgi",
      confidence: 0.1,
      reasoning: "parse error fallback",
      detectedLocation: null
    };
  }
};

export const classifyConsumer = async (input: { title: string; content: string }) => {
  const [categories, regions, template] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: {
        name: true,
        slug: true,
        description: true,
        aiClassificationKeywords: true,
        locationDependent: true
      }
    }),
    prisma.region.findMany({
      where: { isActive: true },
      select: { nameTr: true, aliases: true, slug: true }
    }),
    getPromptTemplate("classify")
  ]);

  const categoriesText = categories
    .map((c) => {
      const description = c.description?.trim() || DEFAULT_CATEGORY_DESCRIPTIONS[c.slug] || c.name;
      return `${c.slug}: ${description} [keywords=${c.aiClassificationKeywords.join(",")}]`;
    })
    .join("\n");
  const regionsText = regions.map((r) => `${r.nameTr} (${r.slug}) aliases: ${r.aliases.join(",")}`).join("\n");

  const prompt = interpolateTemplate(template, {
    title: input.title,
    content: input.content,
    categories: categoriesText,
    regions: regionsText
  });

  const output = await callModelText("gpt-4o-mini", prompt);
  const classification = parseClassification(output);
  const categoryExists = categories.some((category) => category.slug === classification.categorySlug);
  if (!categoryExists) {
    logger.warn(
      {
        event: "classification_slug_fallback",
        requestedSlug: classification.categorySlug,
        fallbackSlug: "genel-bilgi",
        confidence: classification.confidence
      },
      "classification produced unknown slug; fallback applied"
    );
    return {
      categorySlug: "genel-bilgi",
      confidence: 0.3,
      reasoning: `${classification.reasoning} | fallback: unknown category slug '${classification.categorySlug}'`,
      detectedLocation: classification.detectedLocation
    };
  }
  return classification;
};

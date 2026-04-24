import { prisma } from "@trakyahaber/database";

type ArticleForSocial = {
  title: string;
  summary?: string | null;
  socialText?: string | null;
  slug: string;
  category?: { slug: string } | null;
  location?: string | null;
};

const INSTAGRAM_MAX = 2200;
const FACEBOOK_MAX = 63206;

const sanitizeTag = (value: string) =>
  value
    .replace(/#/g, "")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .trim();

const titleLine = (emoji: string, title: string) => `${emoji} ${title}`.trim();

const truncate = (text: string, max: number) => {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

export const generateHashtags = async (article: ArticleForSocial): Promise<string[]> => {
  const categorySlug = article.category?.slug ?? null;
  const location = article.location?.trim() ?? null;
  const normalizedLocationSlug = location
    ? location
        .toLocaleLowerCase("tr-TR")
        .replace(/\s+/g, "-")
        .replace(/[^\p{L}\p{N}-]/gu, "")
    : null;

  const [category, region] = await Promise.all([
    categorySlug
      ? prisma.category.findUnique({
          where: { slug: categorySlug },
          select: { defaultHashtags: true }
        })
      : Promise.resolve(null),
    location
      ? prisma.region.findFirst({
          where: {
            isActive: true,
            OR: [
              { slug: normalizedLocationSlug ?? undefined },
              { nameTr: location },
              { aliases: { has: location } }
            ]
          },
          select: { nameTr: true }
        })
      : Promise.resolve(null)
  ]);

  const categoryTags = (category?.defaultHashtags ?? []).map(sanitizeTag).filter(Boolean);
  const locationTags = region?.nameTr ? [sanitizeTag(region.nameTr)] : [];
  const alwaysTags = ["TrakyaHaber"];

  return [...new Set([...categoryTags, ...locationTags, ...alwaysTags])].filter(Boolean);
};

export const instagramFormat = async (article: ArticleForSocial, emoji = "📰") => {
  const hashtags = await generateHashtags(article);
  const hashtagLine = hashtags.map((tag) => `#${tag}`).join(" ");
  const body = article.socialText || article.summary || "";
  const captionRaw = `${titleLine(emoji, article.title)}\n\n${body}\n\n${hashtagLine}`.trim();
  return {
    caption: truncate(captionRaw, INSTAGRAM_MAX),
    hashtags
  };
};

export const facebookFormat = async (article: ArticleForSocial, articleUrl: string, emoji = "📰") => {
  const hashtags = await generateHashtags(article);
  const hashtagLine = hashtags.map((tag) => `#${tag}`).join(" ");
  const body = article.socialText || article.summary || "";
  const messageRaw = `${titleLine(emoji, article.title)}\n\n${body}\n\n${articleUrl}\n${hashtagLine}`.trim();
  return {
    message: truncate(messageRaw, FACEBOOK_MAX),
    link: articleUrl,
    hashtags
  };
};

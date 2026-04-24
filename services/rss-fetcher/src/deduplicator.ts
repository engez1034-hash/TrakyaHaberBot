import { prisma } from "@trakyahaber/database";
import type { NormalizedFeedItem } from "./normalizer.js";

const MAX_TITLE_DISTANCE = 8;

const levenshteinDistance = (a: string, b: string): number => {
  const s = a.toLowerCase().trim();
  const t = b.toLowerCase().trim();
  const matrix: number[][] = Array.from({ length: s.length + 1 }, () =>
    Array<number>(t.length + 1).fill(0)
  );

  for (let i = 0; i <= s.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= t.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[s.length][t.length];
};

export const isDuplicateItem = async (item: NormalizedFeedItem) => {
  const exact = await prisma.rawArticle.findUnique({
    where: { sourceUrlHash: item.sourceUrlHash },
    select: { id: true }
  });
  if (exact) return true;

  const candidates = await prisma.rawArticle.findMany({
    where: {
      publishedAt: item.publishedAt
        ? {
            gte: new Date(item.publishedAt.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(item.publishedAt.getTime() + 24 * 60 * 60 * 1000)
          }
        : undefined
    },
    select: { title: true },
    orderBy: { fetchedAt: "desc" },
    take: 50
  });

  return candidates.some(
    (candidate) => levenshteinDistance(candidate.title, item.title) <= MAX_TITLE_DISTANCE
  );
};
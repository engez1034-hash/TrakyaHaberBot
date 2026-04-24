import Parser from "rss-parser";
import { prisma } from "@trakyahaber/database";
import { logger } from "@trakyahaber/logger";

export type FetchedFeedItem = {
  title: string;
  content?: string;
  description?: string;
  author?: string;
  publishedAt?: Date;
  imageUrl?: string;
  sourceUrl: string;
};

export type FetchFeedResult = {
  items: FetchedFeedItem[];
  durationMs: number;
  sourceUrl: string;
};

const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_COUNT = 3;

type ParserItem = {
  title?: string;
  content?: string;
  "content:encoded"?: string;
  contentSnippet?: string;
  summary?: string;
  author?: string;
  creator?: string;
  pubDate?: string;
  isoDate?: string;
  link?: string;
  guid?: string;
  enclosure?: { url?: string };
  media?: { thumbnail?: Array<{ $?: { url?: string } }> };
  "media:content"?: { $?: { url?: string } };
  "media:thumbnail"?: { $?: { url?: string } };
};

const parser = new Parser<Record<string, never>, ParserItem>({
  timeout: REQUEST_TIMEOUT_MS,
  customFields: {
    item: [
      ["media:content", "media:content"],
      ["media:thumbnail", "media:thumbnail"],
      ["content:encoded", "content:encoded"]
    ]
  }
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseDate = (value?: string) => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const extractImage = (item: ParserItem) =>
  item.enclosure?.url ??
  item["media:content"]?.$?.url ??
  item["media:thumbnail"]?.$?.url ??
  item.media?.thumbnail?.[0]?.$?.url;

export const createFetchRun = async (sourceId: string) => {
  return prisma.rssFetchRun.create({
    data: {
      sourceId,
      status: "running",
      startedAt: new Date()
    }
  });
};

export const completeFetchRun = async (params: {
  runId: string;
  sourceId: string;
  status: "completed" | "failed";
  itemsFetched: number;
  itemsNew: number;
  itemsDuplicate: number;
  durationMs: number;
  errorMessage?: string;
}) => {
  await prisma.$transaction([
    prisma.rssFetchRun.update({
      where: { id: params.runId },
      data: {
        status: params.status,
        itemsFetched: params.itemsFetched,
        itemsNew: params.itemsNew,
        itemsDuplicate: params.itemsDuplicate,
        durationMs: params.durationMs,
        errorMessage: params.errorMessage,
        completedAt: new Date()
      }
    }),
    prisma.rssSource.update({
      where: { id: params.sourceId },
      data: {
        lastFetchedAt: new Date(),
        lastFetchStatus: params.status,
        lastFetchError: params.errorMessage
      }
    })
  ]);
};

export const fetchRss = async (sourceUrl: string): Promise<FetchFeedResult> => {
  const startedAt = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      const feed = await parser.parseURL(sourceUrl);
      const items = (feed.items ?? [])
        .map<FetchedFeedItem | null>((item) => {
          const sourceUrlItem = item.link ?? item.guid;
          const title = item.title?.trim();
          if (!sourceUrlItem || !title) return null;

          return {
            title,
            sourceUrl: sourceUrlItem,
            content: item["content:encoded"] ?? item.content,
            description: item.contentSnippet ?? item.summary,
            author: item.author ?? item.creator,
            publishedAt: parseDate(item.isoDate ?? item.pubDate),
            imageUrl: extractImage(item)
          };
        })
        .filter((x): x is FetchedFeedItem => Boolean(x));

      return {
        items,
        sourceUrl,
        durationMs: Date.now() - startedAt
      };
    } catch (error) {
      lastError = error;
      logger.warn(
        { sourceUrl, attempt, err: error },
        "rss fetch attempt failed"
      );
      if (attempt < RETRY_COUNT) {
        await wait(2 ** (attempt - 1) * 1000);
      }
    }
  }

  throw Object.assign(new Error("RSS feed fetch failed"), { cause: lastError });
};

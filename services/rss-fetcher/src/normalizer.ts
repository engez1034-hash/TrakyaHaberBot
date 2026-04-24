import { createHash } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import type { FetchedFeedItem } from "./fetcher.js";

export type NormalizedFeedItem = {
  title: string;
  content?: string;
  description?: string;
  author?: string;
  publishedAt?: Date;
  imageUrl?: string;
  sourceUrl: string;
  sourceUrlHash: string;
};

const toAbsoluteUrl = (candidate: string | undefined, baseUrl: string) => {
  if (!candidate) return undefined;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return candidate;
  }
};

const normalizeDate = (value?: Date) => {
  if (!value) return undefined;
  return Number.isNaN(value.getTime()) ? undefined : value;
};

const cleanText = (value?: string) => {
  if (!value) return undefined;
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
};

export const buildSourceUrlHash = (sourceUrl: string) =>
  createHash("sha256").update(sourceUrl.trim()).digest("hex");

export const normalizeFeedItem = (
  item: FetchedFeedItem,
  sourceBaseUrl: string
): NormalizedFeedItem => {
  const sourceUrl = toAbsoluteUrl(item.sourceUrl, sourceBaseUrl) ?? item.sourceUrl;
  return {
    title: cleanText(item.title) ?? item.title,
    content: cleanText(item.content),
    description: cleanText(item.description),
    author: cleanText(item.author),
    publishedAt: normalizeDate(item.publishedAt),
    imageUrl: toAbsoluteUrl(item.imageUrl, sourceBaseUrl),
    sourceUrl,
    sourceUrlHash: buildSourceUrlHash(sourceUrl)
  };
};

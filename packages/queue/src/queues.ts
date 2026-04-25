export const QUEUE_NAMES = {
  RSS_FETCH: "rss-fetch",
  AI_CLASSIFY: "ai-classify",
  AI_REWRITE: "ai-rewrite",
  CONTENT_PUBLISH: "content-publish",
  SOCIAL_PUBLISH: "social-publish"
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

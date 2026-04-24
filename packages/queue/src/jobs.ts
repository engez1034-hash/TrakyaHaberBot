export type RssFetchJobPayload = { sourceId: string };
export type AiClassifyJobPayload = { rawArticleId: string; sourceId?: string; reprocess?: boolean };
export type AiRewriteJobPayload = { articleId: string };
export type ContentPublishJobPayload = { articleId: string };
export type SocialPublishJobPayload = { socialPostId: string };

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RssFetchJobPayload {
  sourceId: string;
}

export interface AiClassifyJobPayload {
  rawArticleId: string;
  sourceId?: string;
  reprocess?: boolean;
}

export interface AiRewriteJobPayload {
  articleId: string;
}

export interface ContentPublishJobPayload {
  articleId: string;
}

export interface SocialPublishJobPayload {
  socialPostId: string;
}

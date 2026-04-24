export type ClassificationResult = {
  categorySlug: string;
  confidence: number;
  reasoning: string;
  detectedLocation: string | null;
};

export type RewriteResult = {
  summary: string;
  socialText: string;
  hashtags: string[];
};

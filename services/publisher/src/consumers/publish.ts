import type { SocialPostStatus } from "@prisma/client";
import { prisma } from "@trakyahaber/database";
import { logger } from "@trakyahaber/logger";
import type { ContentPublishJobPayload, SocialPublishJobPayload } from "@trakyahaber/types";
import { facebookFormat, instagramFormat } from "../formatters/content.js";
import { publishFacebook } from "../platforms/facebook.js";
import { publishInstagram } from "../platforms/instagram.js";

export type QueueLike<T> = {
  add: (
    name: string,
    data: T,
    opts?: {
      delay?: number;
      attempts?: number;
      backoff?: { type: "exponential"; delay: number };
      removeOnComplete?: number | boolean;
      removeOnFail?: number | boolean;
    }
  ) => Promise<unknown>;
};

const SOCIAL_APPROVAL_SETTING_KEY = "social_approval_required";
const META_ERROR_RATE_LIMIT = 429;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_RETRY_DELAY_MS = 60_000;

const getApprovalRequired = async () => {
  const row = await prisma.systemSetting.findUnique({ where: { key: SOCIAL_APPROVAL_SETTING_KEY } });
  return row?.value === true || row?.value === "true";
};

const getArticleUrl = (slug: string) => {
  const base = process.env.PUBLIC_WEB_URL || "https://trakyahaber.com";
  return `${base.replace(/\/$/, "")}/haber/${slug}`;
};

const nextStatusForPrepared = (approvalRequired: boolean): SocialPostStatus =>
  approvalRequired ? "pending_approval" : "pending";

export const prepareSocialPosts = async (
  payload: ContentPublishJobPayload,
  socialPublishQueue: QueueLike<SocialPublishJobPayload>
) => {
  const article = await prisma.article.findUnique({
    where: { id: payload.articleId },
    include: { category: true }
  });
  if (!article) throw new Error(`article not found: ${payload.articleId}`);

  const accounts = await prisma.socialAccount.findMany({
    where: { isActive: true, autoPublish: true, platform: { in: ["instagram", "facebook"] } }
  });
  if (!accounts.length) return [];

  const approvalRequired = await getApprovalRequired();
  const status = nextStatusForPrepared(approvalRequired);
  const now = Date.now();

  const posts = await Promise.all(
    accounts.map(async (account) => {
      const ig = await instagramFormat(article);
      const socialPost = await prisma.socialPost.create({
        data: {
          articleId: article.id,
          accountId: account.id,
          platform: account.platform,
          status,
          postType: article.imageUrl ? "image" : "text",
          text: account.platform === "instagram" ? ig.caption : article.socialText ?? article.summary ?? article.title,
          hashtags: ig.hashtags,
          mediaUrls: article.imageUrl ? [article.imageUrl] : [],
          scheduledFor: account.publishDelayMinutes > 0 ? new Date(now + account.publishDelayMinutes * 60_000) : null
        }
      });

      if (!approvalRequired) {
        const delay = Math.max(0, (socialPost.scheduledFor?.getTime() ?? now) - now);
        await socialPublishQueue.add(
          "social-publish-post",
          { socialPostId: socialPost.id },
          {
            delay,
            attempts: MAX_ATTEMPTS,
            backoff: { type: "exponential", delay: 10_000 }
          }
        );
      }

      return socialPost;
    })
  );

  return posts;
};

export const publishSocialPost = async (payload: SocialPublishJobPayload) => {
  const post = await prisma.socialPost.findUnique({
    where: { id: payload.socialPostId },
    include: { article: { include: { category: true } }, account: true }
  });
  if (!post) throw new Error(`social post not found: ${payload.socialPostId}`);

  if (post.status === "pending_approval") {
    logger.info({ socialPostId: post.id }, "social post waiting approval, publish skipped");
    return;
  }

  if (post.scheduledFor && post.scheduledFor.getTime() > Date.now()) {
    logger.info({ socialPostId: post.id }, "social post scheduled for future, publish skipped");
    return;
  }

  await prisma.socialPost.update({ where: { id: post.id }, data: { status: "publishing" } });
  const articleUrl = getArticleUrl(post.article.slug);
  // NOTE: accessToken/refreshToken fields should be stored encrypted at rest.
  // TODO: implement Meta long-lived token refresh exchange when token is near expiry.
  if (post.account.tokenExpiresAt && post.account.tokenExpiresAt.getTime() <= Date.now()) {
    throw new Error("social account token expired; refresh flow required");
  }

  const start = Date.now();
  try {
    let publishResult: { platformPostId: string; raw: unknown };
    if (post.platform === "instagram") {
      const formatted = await instagramFormat(post.article);
      publishResult = await publishInstagram({
        igUserId: post.account.platformUserId,
        accessToken: post.account.accessToken,
        caption: formatted.caption,
        mediaUrls: post.mediaUrls
      });
    } else {
      const formatted = await facebookFormat(post.article, articleUrl);
      publishResult = await publishFacebook({
        pageId: post.account.platformUserId,
        accessToken: post.account.accessToken,
        message: formatted.message,
        link: formatted.link,
        mediaUrls: post.mediaUrls
      });
    }

    await prisma.$transaction([
      prisma.socialPostAttempt.create({
        data: {
          socialPostId: post.id,
          attemptNumber: post.retryCount + 1,
          status: "success",
          responseCode: 200,
          responseBody: publishResult.raw as object,
          durationMs: Date.now() - start
        }
      }),
      prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: "published",
          retryCount: post.retryCount + 1,
          publishedAt: new Date(),
          platformPostId: publishResult.platformPostId,
          platformUrl:
            post.platform === "facebook"
              ? `https://facebook.com/${publishResult.platformPostId}`
              : `https://instagram.com/p/${publishResult.platformPostId}`,
          errorMessage: null
        }
      }),
      prisma.socialAccount.update({
        where: { id: post.accountId },
        data: { lastPublishedAt: new Date() }
      })
    ]);
  } catch (error) {
    const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
    const statusCode = axiosError.response?.status ?? 500;
    const errorMessage = axiosError.message ?? "unknown publish error";
    const retryCount = post.retryCount + 1;
    const shouldFail = retryCount >= MAX_ATTEMPTS;
    const isRateLimit = statusCode === META_ERROR_RATE_LIMIT;

    await prisma.$transaction([
      prisma.socialPostAttempt.create({
        data: {
          socialPostId: post.id,
          attemptNumber: retryCount,
          status: "failed",
          responseCode: statusCode,
          responseBody: (axiosError.response?.data as object) ?? null,
          errorMessage,
          durationMs: Date.now() - start
        }
      }),
      prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: shouldFail ? "failed" : "pending",
          retryCount,
          errorMessage,
          scheduledFor: !shouldFail && isRateLimit ? new Date(Date.now() + RATE_LIMIT_RETRY_DELAY_MS) : post.scheduledFor
        }
      })
    ]);

    if (shouldFail) {
      await prisma.processingFailure.create({
        data: {
          stage: "social_publish",
          entityType: "social_post",
          entityId: post.id,
          errorMessage,
          retryCount,
          maxRetries: MAX_ATTEMPTS,
          metadata: {
            socialPostId: post.id,
            platform: post.platform,
            statusCode
          }
        }
      });
    }

    const err = new Error(errorMessage);
    (err as Error & { rateLimit?: boolean }).rateLimit = statusCode === META_ERROR_RATE_LIMIT;
    throw err;
  }
};

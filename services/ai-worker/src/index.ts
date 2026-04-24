import { createServer } from "node:http";
import type { FailureStage } from "@prisma/client";
import { ArticleStatus } from "@prisma/client";
import { Worker, Queue, QueueEvents } from "bullmq";
import { env } from "@trakyahaber/config";
import { prisma } from "@trakyahaber/database";
import { logger } from "@trakyahaber/logger";
import { createRedisConnection, QUEUE_NAMES } from "@trakyahaber/queue";
import type { AiClassifyJobPayload, ContentPublishJobPayload } from "@trakyahaber/types";
import { translateConsumer } from "./consumers/translate.js";
import { classifyConsumer } from "./consumers/classify.js";
import { isAllowedLocation } from "./filters/location.js";
import { rewriteConsumer } from "./consumers/rewrite.js";

const connection = createRedisConnection();
const publishQueue = new Queue<ContentPublishJobPayload>(QUEUE_NAMES.CONTENT_PUBLISH, { connection });
const deadLetterQueue = new Queue<AiClassifyJobPayload>(`${QUEUE_NAMES.AI_CLASSIFY}:dlq`, { connection });
const queueEvents = new QueueEvents(QUEUE_NAMES.AI_CLASSIFY, { connection });

const getModerationEnabled = async () => {
  const row = await prisma.systemSetting.findUnique({ where: { key: "moderation.web_publish.enabled" } });
  const dbEnabled = row?.value === true || row?.value === "true";
  return env.FORCE_MODERATION || dbEnabled;
};

const getAiConfidenceThreshold = async () => {
  const row = await prisma.systemSetting.findUnique({ where: { key: "ai_confidence_threshold" } });
  const value = typeof row?.value === "number" ? row.value : Number(row?.value);
  if (Number.isFinite(value)) {
    return value;
  }
  return 0.6;
};

const saveFailure = async (
  stage: FailureStage,
  entityId: string,
  error: unknown,
  retryCount: number,
  maxRetries: number,
  metadata?: Record<string, unknown>
) => {
  await prisma.processingFailure.create({
    data: {
      stage,
      entityType: "raw_article",
      entityId,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      retryCount,
      maxRetries,
      nextRetryAt: retryCount < maxRetries ? new Date(Date.now() + 5000) : undefined,
      metadata
    }
  });
};

const worker = new Worker<AiClassifyJobPayload>(
  QUEUE_NAMES.AI_CLASSIFY,
  async (job) => {
    const raw = await prisma.rawArticle.findUnique({
      where: { id: job.data.rawArticleId },
      include: { source: true, article: true }
    });
    if (!raw) {
      logger.warn({ rawArticleId: job.data.rawArticleId }, "raw article not found");
      return;
    }

    await prisma.$transaction(async (tx) => {
      let article = raw.article;
      if (job.data.reprocess && article) {
        await tx.articleRevision.create({
          data: {
            articleId: article.id,
            title: article.title,
            content: article.content,
            changeReason: "ai_reprocess"
          }
        });
      }

      const translated = await translateConsumer(raw);
      if (!article) {
        const fallbackCategory = await tx.category.findFirst({
          where: { isActive: true },
          orderBy: { displayOrder: "asc" }
        });
        if (!fallbackCategory) throw new Error("no active category found");
        article = await tx.article.create({
          data: {
            rawArticleId: raw.id,
            sourceId: raw.sourceId,
            categoryId: fallbackCategory.id,
            slug: `raw-${raw.id}`,
            title: translated.title,
            content: translated.content,
            originalTitle: raw.title,
            originalContent: raw.content ?? raw.description,
            originalUrl: raw.sourceUrl,
            imageUrl: raw.imageUrl,
            author: raw.author,
            status: ArticleStatus.rewritten
          }
        });
      } else {
        article = await tx.article.update({
          where: { id: article.id },
          data: {
            title: translated.title,
            content: translated.content,
            originalTitle: raw.title,
            originalContent: raw.content ?? raw.description,
            status: ArticleStatus.rewritten
          }
        });
      }

      const classification = await classifyConsumer({
        title: translated.title,
        content: translated.content
      });
      const confidenceThreshold = await getAiConfidenceThreshold();
      const category = await tx.category.findUnique({ where: { slug: classification.categorySlug } });
      if (!category) throw new Error(`category not found: ${classification.categorySlug}`);

      const locationCheck = await isAllowedLocation({
        categoryId: category.id,
        text: `${translated.title} ${translated.content}`,
        detectedLocation: classification.detectedLocation
      });

      if (!locationCheck.allowed) {
        await tx.article.update({
          where: { id: article.id },
          data: {
            categoryId: category.id,
            location: classification.detectedLocation ?? null,
            aiClassification: classification,
            status: ArticleStatus.filtered_out
          }
        });
        await tx.rawArticle.update({
          where: { id: raw.id },
          data: { processed: true, processedAt: new Date() }
        });
        return;
      }

      const rewritten = await rewriteConsumer({
        title: translated.title,
        content: translated.content,
        categoryName: category.name,
        emoji: category.emoji
      });
      const moderationEnabled = await getModerationEnabled();
      const isLowConfidence = classification.confidence < confidenceThreshold;
      if (isLowConfidence) {
        logger.info(
          {
            event: "classification_low_confidence",
            rawArticleId: raw.id,
            articleId: article.id,
            confidence: classification.confidence,
            threshold: confidenceThreshold
          },
          "low confidence classification; forcing pending_review"
        );
      }
      const finalStatus = isLowConfidence
        ? ArticleStatus.pending_review
        : moderationEnabled
          ? ArticleStatus.pending_review
          : ArticleStatus.approved;

      const updated = await tx.article.update({
        where: { id: article.id },
        data: {
          categoryId: category.id,
          title: rewritten.title,
          content: rewritten.content,
          summary: rewritten.summary,
          socialText: rewritten.socialText,
          hashtags: rewritten.hashtags,
          location: locationCheck.location ?? classification.detectedLocation,
          aiClassification: {
            ...classification,
            lowConfidence: isLowConfidence
          },
          status: finalStatus
        }
      });

      await tx.rawArticle.update({
        where: { id: raw.id },
        data: { processed: true, processedAt: new Date() }
      });

      if (updated.slug === `raw-${raw.id}`) {
        const shortId = updated.id.slice(0, 8);
        await tx.article.update({
          where: { id: updated.id },
          data: { slug: `${category.slug}-${shortId}` }
        });
      }

      if (!moderationEnabled && finalStatus === ArticleStatus.approved) {
        await publishQueue.add(
          "content-publish-article",
          { articleId: updated.id },
          { removeOnComplete: 1000, removeOnFail: 1000 }
        );
      }
    });
  },
  { connection, concurrency: 3 }
);

queueEvents.on("failed", async ({ jobId, failedReason }) => {
  try {
    const job = await worker.getJob(jobId);
    if (!job) return;
    const attempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= attempts) {
      await deadLetterQueue.add("ai-classify-dead-letter", job.data, {
        removeOnComplete: 1000,
        removeOnFail: 1000
      });
    }
    await saveFailure("classification", job.data.rawArticleId, new Error(failedReason), job.attemptsMade, attempts, {
      queue: QUEUE_NAMES.AI_CLASSIFY,
      jobId,
      manualIntervention: true
    });
  } catch (error) {
    logger.error({ err: error }, "failed to write ai-worker failure");
  }
});

const healthServer = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "ai-worker" }));
});

const start = async () => {
  healthServer.listen(3012, () => logger.info("ai-worker health endpoint listening on 3012"));
  logger.info("ai-worker service bootstrapped");
};

let isShuttingDown = false;
const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  await worker.close();
  await queueEvents.close();
  await publishQueue.close();
  await deadLetterQueue.close();
  await connection.quit();
  await prisma.$disconnect();
  healthServer.close();
  logger.info("ai-worker shutdown completed");
};

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

void start();

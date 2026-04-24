import { createServer } from "node:http";
import { Worker, Queue, QueueEvents } from "bullmq";
import { prisma } from "@trakyahaber/database";
import { env } from "@trakyahaber/config";
import { logger } from "@trakyahaber/logger";
import { createRedisConnection, QUEUE_NAMES } from "@trakyahaber/queue";
import type { AiClassifyJobPayload, RssFetchJobPayload } from "@trakyahaber/types";
import { createFetchRun, completeFetchRun, fetchRss } from "./fetcher.js";
import { normalizeFeedItem } from "./normalizer.js";
import { isDuplicateItem } from "./deduplicator.js";
import { RssScheduler } from "./scheduler.js";

const connection = createRedisConnection();
const scheduler = new RssScheduler();

const classifyQueue = new Queue<AiClassifyJobPayload>(QUEUE_NAMES.AI_CLASSIFY, {
  connection
});

const deadLetterQueue = new Queue<RssFetchJobPayload>(`${QUEUE_NAMES.RSS_FETCH}:dlq`, {
  connection
});

const queueEvents = new QueueEvents(QUEUE_NAMES.RSS_FETCH, { connection });

const worker = new Worker<RssFetchJobPayload>(
  QUEUE_NAMES.RSS_FETCH,
  async (job) => {
    const source = await prisma.rssSource.findUnique({
      where: { id: job.data.sourceId },
      select: { id: true, url: true, isActive: true }
    });
    if (!source || !source.isActive) {
      logger.warn({ sourceId: job.data.sourceId }, "rss source missing or inactive");
      return;
    }

    const run = await createFetchRun(source.id);
    const startedAt = Date.now();
    let itemsFetched = 0;
    let itemsNew = 0;
    let itemsDuplicate = 0;

    try {
      const fetched = await fetchRss(source.url);
      itemsFetched = fetched.items.length;

      for (const raw of fetched.items) {
        try {
          const normalized = normalizeFeedItem(raw, source.url);
          const duplicate = await isDuplicateItem(normalized);
          if (duplicate) {
            itemsDuplicate += 1;
            continue;
          }

          const created = await prisma.rawArticle.create({
            data: {
              sourceId: source.id,
              sourceUrl: normalized.sourceUrl,
              sourceUrlHash: normalized.sourceUrlHash,
              title: normalized.title,
              content: normalized.content,
              description: normalized.description,
              author: normalized.author,
              publishedAt: normalized.publishedAt,
              imageUrl: normalized.imageUrl
            }
          });
          itemsNew += 1;

          await classifyQueue.add(
            "ai-classify-raw-article",
            { rawArticleId: created.id },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 1000 },
              removeOnComplete: 1000,
              removeOnFail: 1000
            }
          );
        } catch (error) {
          logger.warn({ sourceId: source.id, err: error }, "rss item parse/write skipped");
        }
      }

      await completeFetchRun({
        runId: run.id,
        sourceId: source.id,
        status: "completed",
        itemsFetched,
        itemsNew,
        itemsDuplicate,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      await completeFetchRun({
        runId: run.id,
        sourceId: source.id,
        status: "failed",
        itemsFetched,
        itemsNew,
        itemsDuplicate,
        durationMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : "Unknown fetch error"
      });
      throw error;
    }
  },
  { connection, concurrency: 3 }
);

queueEvents.on("failed", async ({ jobId, failedReason }) => {
  try {
    const job = await worker.getJob(jobId);
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= attempts) {
      await deadLetterQueue.add("rss-fetch-dead-letter", job.data, {
        removeOnComplete: 1000,
        removeOnFail: 1000
      });
    }
    await prisma.processingFailure.create({
      data: {
        stage: "rss_fetch",
        entityType: "rss_source",
        entityId: job.data.sourceId,
        errorMessage: failedReason,
        retryCount: job.attemptsMade,
        maxRetries: attempts,
        nextRetryAt: job.attemptsMade < attempts ? new Date(Date.now() + 5000) : undefined,
        metadata: { queue: QUEUE_NAMES.RSS_FETCH, jobId }
      }
    });
  } catch (error) {
    logger.error({ err: error }, "failed to write processing failure");
  }
});

const healthServer = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "rss-fetcher" }));
});

const start = async () => {
  if (env.DISABLE_RSS_FETCH) {
    logger.warn("rss-fetcher disabled by environment");
    return;
  }

  await scheduler.start();
  healthServer.listen(3011, () => logger.info("rss-fetcher health endpoint listening on 3011"));
  logger.info("rss-fetcher service bootstrapped");
};

let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info("rss-fetcher graceful shutdown started");
  await scheduler.shutdown();
  await worker.close();
  await queueEvents.close();
  await classifyQueue.close();
  await deadLetterQueue.close();
  await connection.quit();
  await prisma.$disconnect();
  healthServer.close();
  logger.info("rss-fetcher shutdown completed");
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

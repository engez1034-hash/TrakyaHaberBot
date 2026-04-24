import { createServer } from "node:http";
import { Queue, QueueEvents, Worker } from "bullmq";
import { prisma } from "@trakyahaber/database";
import { logger } from "@trakyahaber/logger";
import { createRedisConnection, QUEUE_NAMES } from "@trakyahaber/queue";
import type { ContentPublishJobPayload, SocialPublishJobPayload } from "@trakyahaber/types";
import { prepareSocialPosts, publishSocialPost } from "./consumers/publish.js";

const connection = createRedisConnection();
const socialPublishQueue = new Queue<SocialPublishJobPayload>(QUEUE_NAMES.SOCIAL_PUBLISH, { connection });
const socialDlqQueue = new Queue<SocialPublishJobPayload>(`${QUEUE_NAMES.SOCIAL_PUBLISH}:dlq`, { connection });
const contentEvents = new QueueEvents(QUEUE_NAMES.CONTENT_PUBLISH, { connection });
const socialEvents = new QueueEvents(QUEUE_NAMES.SOCIAL_PUBLISH, { connection });

const contentWorker = new Worker<ContentPublishJobPayload>(
  QUEUE_NAMES.CONTENT_PUBLISH,
  async (job) => {
    await prepareSocialPosts(job.data, socialPublishQueue);
  },
  { connection, concurrency: 4 }
);

const socialWorker = new Worker<SocialPublishJobPayload>(
  QUEUE_NAMES.SOCIAL_PUBLISH,
  async (job) => {
    await publishSocialPost(job.data);
  },
  {
    connection,
    concurrency: 3,
    settings: { backoffStrategy: () => 10_000 }
  }
);

socialEvents.on("failed", async ({ jobId, failedReason }) => {
  const job = await socialWorker.getJob(jobId);
  if (!job) return;
  const attempts = job.opts.attempts ?? 3;
  if (job.attemptsMade >= attempts) {
    await socialDlqQueue.add("social-publish-dead-letter", job.data, {
      removeOnComplete: 1000,
      removeOnFail: 1000
    });
  }
  logger.error({ jobId, failedReason }, "social publish failed");
});

const healthServer = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "publisher" }));
});

const start = async () => {
  await Promise.all([contentEvents.waitUntilReady(), socialEvents.waitUntilReady()]);
  healthServer.listen(3013, () => logger.info("publisher health endpoint listening on 3013"));
  logger.info("publisher service bootstrapped");
};

let isShuttingDown = false;
const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  await Promise.all([
    contentWorker.close(),
    socialWorker.close(),
    contentEvents.close(),
    socialEvents.close(),
    socialPublishQueue.close(),
    socialDlqQueue.close()
  ]);
  await connection.quit();
  await prisma.$disconnect();
  healthServer.close();
  logger.info("publisher shutdown completed");
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

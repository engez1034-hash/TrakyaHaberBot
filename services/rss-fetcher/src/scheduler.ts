import cron, { type ScheduledTask } from "node-cron";
import { Queue } from "bullmq";
import { prisma } from "@trakyahaber/database";
import { env } from "@trakyahaber/config";
import { logger } from "@trakyahaber/logger";
import { createRedisConnection, QUEUE_NAMES } from "@trakyahaber/queue";
import type { RssFetchJobPayload } from "@trakyahaber/types";

const DEFAULT_INTERVAL_MINUTES = 10;

export class RssScheduler {
  private readonly connection = createRedisConnection();
  private readonly fetchQueue = new Queue<RssFetchJobPayload>(QUEUE_NAMES.RSS_FETCH, {
    connection: this.connection
  });
  private tasks: ScheduledTask[] = [];

  private async scheduleSources() {
    const sources = await prisma.rssSource.findMany({
      where: { isActive: true },
      select: { id: true, fetchIntervalMinutes: true, name: true }
    });

    for (const source of sources) {
      const interval = source.fetchIntervalMinutes || DEFAULT_INTERVAL_MINUTES;
      const task = cron.schedule(`*/${interval} * * * *`, async () => {
        try {
          await this.fetchQueue.add(
            "rss-fetch-source",
            { sourceId: source.id },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 1000 },
              removeOnComplete: 1000,
              removeOnFail: 1000
            }
          );
          logger.info({ sourceId: source.id, interval }, "rss source fetch job queued");
        } catch (error) {
          logger.error({ sourceId: source.id, err: error }, "failed to queue rss fetch job");
        }
      });
      this.tasks.push(task);
      logger.info({ sourceId: source.id, name: source.name, interval }, "rss source scheduled");
    }
  }

  async start() {
    if (env.DISABLE_RSS_FETCH) {
      logger.warn("rss fetch disabled by environment");
      return;
    }
    await this.scheduleSources();
  }

  async shutdown() {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    await this.fetchQueue.close();
    await this.connection.quit();
  }
}

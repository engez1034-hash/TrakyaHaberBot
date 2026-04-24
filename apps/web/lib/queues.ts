import { Queue } from "bullmq";
import {
  createRedisConnection,
  QUEUE_NAMES,
  type AiClassifyJobPayload,
  type SocialPublishJobPayload
} from "@trakyahaber/queue";

const connection = createRedisConnection();

export const aiClassifyQueue = new Queue<AiClassifyJobPayload>(QUEUE_NAMES.AI_CLASSIFY, { connection });
export const socialPublishQueue = new Queue<SocialPublishJobPayload>(QUEUE_NAMES.SOCIAL_PUBLISH, { connection });

import { openai } from "@trakyahaber/ai";
import { logger } from "@trakyahaber/logger";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { status?: number; code?: string };
  return maybe.status === 429 || maybe.code === "rate_limit_exceeded";
};

export const llmClientName = "openai";

export const runWithRetry = async <T>(
  label: string,
  fn: () => Promise<T>,
  maxRetries = 3
) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) break;
      if (!isRateLimitError(error)) continue;
      const waitMs = 500 * 2 ** (attempt - 1);
      logger.warn({ label, attempt, waitMs }, "openai rate limit, retrying");
      await sleep(waitMs);
    }
  }
  throw lastError;
};

export const callModelText = async (model: string, prompt: string) => {
  const startedAt = Date.now();
  const response = await runWithRetry("openai-text", async () =>
    openai.responses.create({
      model,
      input: prompt
    })
  );
  const text = response.output_text?.trim() ?? "";
  logger.info(
    {
      model,
      durationMs: Date.now() - startedAt,
      usage: response.usage
    },
    "openai completion done"
  );
  return text;
};

import { getPromptTemplate, interpolateTemplate } from "../llm/prompts.js";
import { callModelText } from "../llm/openai.js";
import type { RewriteResult } from "../types.js";

const parseRewrite = (text: string): RewriteResult => {
  try {
    const parsed = JSON.parse(text) as Partial<RewriteResult>;
    if (parsed.summary && parsed.socialText && Array.isArray(parsed.hashtags)) {
      return {
        summary: parsed.summary,
        socialText: parsed.socialText.slice(0, 280),
        hashtags: parsed.hashtags.slice(0, 10).map((x) => `${x}`.replace(/^#*/, ""))
      };
    }
  } catch {
    // noop
  }
  const summary = text.slice(0, 220);
  return {
    summary,
    socialText: text.slice(0, 280),
    hashtags: []
  };
};

export const rewriteConsumer = async (input: {
  title: string;
  content: string;
  categoryName: string;
  emoji: string;
}) => {
  const template = await getPromptTemplate("rewrite");
  const prompt = interpolateTemplate(template, {
    title: input.title,
    content: input.content,
    categories: input.categoryName,
    regions: ""
  });
  const output = await callModelText("gpt-4o", prompt);
  const social = parseRewrite(output);
  const titleWithEmoji = input.title.startsWith(input.emoji) ? input.title : `${input.emoji} ${input.title}`.trim();
  return { ...social, title: titleWithEmoji, content: input.content };
};

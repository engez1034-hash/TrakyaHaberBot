import { ArticleStatus, type RawArticle } from "@prisma/client";
import { callModelText } from "../llm/openai.js";
import { getPromptTemplate, interpolateTemplate } from "../llm/prompts.js";

type TranslateResult = { title: string; content: string };

const parseTranslateOutput = (text: string, fallbackTitle: string, fallbackContent: string): TranslateResult => {
  try {
    const parsed = JSON.parse(text) as Partial<TranslateResult>;
    if (parsed.title && parsed.content) {
      return { title: parsed.title, content: parsed.content };
    }
  } catch {
    // noop
  }
  return {
    title: fallbackTitle,
    content: text || fallbackContent
  };
};

export const translateConsumer = async (raw: RawArticle): Promise<TranslateResult> => {
  const template = await getPromptTemplate("translate");
  const prompt = interpolateTemplate(template, {
    title: raw.title,
    content: raw.content ?? raw.description ?? ""
  });
  const output = await callModelText("gpt-4o", prompt);
  const translated = parseTranslateOutput(output, raw.title, raw.content ?? raw.description ?? "");
  return {
    title: translated.title.trim(),
    content: translated.content.trim()
  };
};

export const fetchedStatus = ArticleStatus.fetched;
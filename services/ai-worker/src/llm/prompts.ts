import { prisma } from "@trakyahaber/database";

const DEFAULT_PROMPTS = {
  translate:
    "Asagidaki Yunanca haberi dogal ve akici Turkce haber diline cevir. Cikti yalnizca cevrilmis baslik ve icerik olsun.\nBaslik: {{title}}\nIcerik: {{content}}",
  classify:
    "Sen bir Turkce haber siniflandirma sistemisin. Asagidaki haberi analiz et ve EN UYGUN kategoriye ata.\n\nKATEGORILER VE NIYETLERI:\n{{categories}}\n\nBOLGELER:\n{{regions}}\n\nKURALLAR:\n1. Haberi SADECE yukaridaki kategori slug larindan birine ata. Baska slug KULLANMA.\n2. Eger haberin niyeti net degilse genel-bilgi kategorisini sec.\n3. detectedLocation alanina haberde gecen sehir/bolge adini yaz (varsa).\n4. confidence degeri 0 ile 1 arasinda olmali. Emin degilsen dusuk ver.\n\nHABER BASLIGI: {{title}}\nHABER ICERIGI: {{content}}\n\nSADECE su JSON formatinda yanit ver, baska hicbir sey yazma:\n{categorySlug:...,confidence:0.0,reasoning:...,detectedLocation:null}",
  rewrite:
    "Asagidaki Turkce haber icin kisa bir ozet, 280 karakteri asmayan sosyal medya metni ve hashtag listesi uret.\nBaslik: {{title}}\nIcerik: {{content}}\nKategori: {{categories}}"
} as const;

export const interpolateTemplate = (template: string, vars: Record<string, string>) => {
  return Object.entries(vars).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{{${key}}}`, value);
  }, template);
};

export const getPromptTemplate = async (type: "translate" | "classify" | "rewrite") => {
  const prompt = await prisma.promptTemplate.findFirst({
    where: { type, isActive: true },
    orderBy: { version: "desc" }
  });
  return prompt?.template ?? DEFAULT_PROMPTS[type];
};

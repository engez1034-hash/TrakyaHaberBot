import { PrismaClient, CategorySeverity, ContentOriginLanguage } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || "changeme123", 10);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || "admin@trakyahaber.com" },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || "admin@trakyahaber.com",
      name: "Admin User",
      passwordHash: adminPassword,
      role: "super_admin",
      isActive: true
    }
  });
  console.log("✅ Admin user created:", admin.email);

  const categories = [
    {
      name: "SON DAKIKA",
      slug: "son-dakika",
      emoji: "🔴",
      severity: "critical" as CategorySeverity,
      locationDependent: true,
      description: "Kaza, yangın, doğal afet, operasyon - Alarm etkisi",
      aiClassificationKeywords: ["kaza", "yangın", "operasyon", "acil", "afet"],
      defaultHashtags: ["SonDakika", "AcilHaber", "TrakyaHaber"],
      displayOrder: 1
    },
    {
      name: "DUYURU",
      slug: "duyuru",
      emoji: "🟡",
      severity: "high" as CategorySeverity,
      locationDependent: true,
      description: "Kesintiler, yol kapamalar, resmi uyarılar, son başvuru tarihleri",
      aiClassificationKeywords: ["kesinti", "kapalı", "uyarı", "duyuru", "başvuru"],
      defaultHashtags: ["Duyuru", "Uyari", "TrakyaHaber"],
      displayOrder: 2
    },
    {
      name: "ODEME HABERI",
      slug: "odeme-haberi",
      emoji: "🟢",
      severity: "medium" as CategorySeverity,
      locationDependent: false,
      description: "Maaş, çocuk parası, hibe, destek - Yunanistan geneli",
      aiClassificationKeywords: ["ödeme", "maaş", "hibe", "destek", "para"],
      defaultHashtags: ["Odeme", "Destek", "YunanistanHaber"],
      displayOrder: 3
    },
    {
      name: "GENEL BILGI",
      slug: "genel-bilgi",
      emoji: "🔵",
      severity: "low" as CategorySeverity,
      locationDependent: true,
      description: "Belediye hizmetleri, kamu faaliyetleri, yerel düzenlemeler",
      aiClassificationKeywords: ["belediye", "hizmet", "faaliyet", "düzenleme"],
      defaultHashtags: ["GenelBilgi", "Trakya", "TrakyaHaber"],
      displayOrder: 4
    }
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category
    });
  }
  console.log("✅ Categories created");

  const regions = [
    {
      nameTr: "Gumulcine",
      nameEl: "Κομοτηνή",
      nameEn: "Komotini",
      slug: "gumulcine",
      aliases: ["Gümülcine", "Komotini", "Κομοτηνή"]
    },
    {
      nameTr: "Iskece",
      nameEl: "Ξάνθη",
      nameEn: "Xanthi",
      slug: "iskece",
      aliases: ["İskeçe", "Xanthi", "Ξάνθη"]
    },
    {
      nameTr: "Dedeagac",
      nameEl: "Αλεξανδρούπολη",
      nameEn: "Alexandroupoli",
      slug: "dedeagac",
      aliases: ["Dedeağaç", "Alexandroupoli", "Αλεξανδρούπολη", "Αλεξανδρούπολις"]
    }
  ];

  for (const region of regions) {
    await prisma.region.upsert({
      where: { slug: region.slug },
      update: region,
      create: region
    });
  }
  console.log("✅ Regions created");

  const rssSources = [
    {
      name: "Xronos",
      url: "https://xronos.gr/rss.xml",
      websiteUrl: "https://xronos.gr",
      language: "el" as ContentOriginLanguage,
      isActive: true,
      fetchIntervalMinutes: 10
    },
    {
      name: "Thrakinea",
      url: "https://thrakinea.gr/feed",
      websiteUrl: "https://thrakinea.gr",
      language: "el" as ContentOriginLanguage,
      isActive: true,
      fetchIntervalMinutes: 10
    },
    {
      name: "Paratiritis News",
      url: "https://paratiritis-news.gr/feed",
      websiteUrl: "https://paratiritis-news.gr",
      language: "el" as ContentOriginLanguage,
      isActive: true,
      fetchIntervalMinutes: 10
    },
    {
      name: "Millet Gazetesi",
      url: "https://milletgazetesi.gr/feed",
      websiteUrl: "https://milletgazetesi.gr",
      language: "tr" as ContentOriginLanguage,
      isActive: true,
      fetchIntervalMinutes: 10
    },
    {
      name: "Ulku Gazetesi",
      url: "https://ulkugazetesi.net/feed",
      websiteUrl: "https://ulkugazetesi.net",
      language: "tr" as ContentOriginLanguage,
      isActive: true,
      fetchIntervalMinutes: 10
    }
  ];

  for (const source of rssSources) {
    await prisma.rssSource.upsert({
      where: { url: source.url },
      update: source,
      create: source
    });
  }
  console.log("✅ RSS sources created");

  const allCategories = await prisma.category.findMany();
  const allRegions = await prisma.region.findMany();
  const categoryMap = new Map(allCategories.map((c) => [c.slug, c.id]));
  const regionIds = allRegions.map((r) => r.id);

  for (const catSlug of ["son-dakika", "duyuru", "genel-bilgi"]) {
    const categoryId = categoryMap.get(catSlug);
    if (!categoryId) continue;
    for (const regionId of regionIds) {
      await prisma.locationRule.upsert({
        where: { categoryId_regionId: { categoryId, regionId } },
        update: { isRequired: true },
        create: { categoryId, regionId, isRequired: true }
      });
    }
  }
  console.log("✅ Location rules created");

  const settings = [
    {
      key: "moderation_enabled",
      value: false,
      description: "Web yayınında moderasyon aktif mi?",
      isPublic: false
    },
    {
      key: "social_approval_required",
      value: false,
      description: "Sosyal medya paylaşımı için onay gerekli mi?",
      isPublic: false
    },
    {
      key: "rss_fetch_interval",
      value: 10,
      description: "Varsayılan RSS çekim aralığı (dakika)",
      isPublic: false
    },
    {
      key: "ai_model_classify",
      value: "gpt-4o-mini",
      description: "Sınıflandırma modeli",
      isPublic: false
    },
    {
      key: "ai_model_rewrite",
      value: "gpt-4o",
      description: "Rewrite modeli",
      isPublic: false
    }
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: setting,
      create: { ...setting, updatedBy: admin.id }
    });
  }
  console.log("✅ System settings created");

  const promptTemplates = [
    {
      name: "classification-v1",
      type: "classification",
      template:
        "Sen TrakyaHaberBot sınıflandırma asistanısın. Metni SON DAKIKA, DUYURU, ODEME HABERI, GENEL BILGI kategorilerinden birine ata. Gumulcine, Iskece, Dedeagac aliaslarını dikkate al. JSON döndür: {category, location, confidence}.",
      variables: ["title", "content", "source"],
      model: "gpt-4o-mini",
      isActive: true,
      version: 1
    },
    {
      name: "rewrite-v1",
      type: "rewrite",
      template:
        "Yunanca haberi doğal, akıcı ve tarafsız Türkçe haber formatında yeniden yaz. Başlık üret, kısa özet çıkar, sosyal metin oluştur, 3-5 hashtag ekle. Çıktı JSON olsun: {title, content, summary, socialText, hashtags}.",
      variables: ["title", "content", "category"],
      model: "gpt-4o",
      isActive: true,
      version: 1
    }
  ];

  for (const prompt of promptTemplates) {
    const existing = await prisma.promptTemplate.findFirst({
      where: { name: prompt.name, version: prompt.version }
    });

    if (existing) {
      await prisma.promptTemplate.update({
        where: { id: existing.id },
        data: {
          type: prompt.type,
          template: prompt.template,
          variables: prompt.variables,
          model: prompt.model,
          isActive: prompt.isActive
        }
      });
    } else {
      await prisma.promptTemplate.create({
        data: {
          ...prompt,
          createdBy: admin.id
        }
      });
    }
  }
  console.log("✅ Prompt templates created");

  console.log("🎉 Seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

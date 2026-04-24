import { prisma } from "@trakyahaber/database";

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export const isAllowedLocation = async (input: {
  categoryId: string;
  text: string;
  detectedLocation: string | null;
}) => {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { locationDependent: true }
  });
  if (!category) return { allowed: false, location: null as string | null };
  if (!category.locationDependent) return { allowed: true, location: input.detectedLocation };

  const [regions, rules] = await Promise.all([
    prisma.region.findMany({
      where: { isActive: true },
      select: { id: true, nameTr: true, aliases: true }
    }),
    prisma.locationRule.findMany({
      where: { categoryId: input.categoryId },
      select: { regionId: true, isRequired: true }
    })
  ]);

  const requiredRegionIds = rules.filter((r) => r.isRequired).map((r) => r.regionId);
  const candidates = regions.filter((r) => requiredRegionIds.length === 0 || requiredRegionIds.includes(r.id));
  const haystack = normalize(`${input.detectedLocation ?? ""} ${input.text}`);

  for (const region of candidates) {
    const names = [region.nameTr, ...region.aliases].map(normalize);
    if (names.some((n) => haystack.includes(n))) {
      return { allowed: true, location: region.nameTr };
    }
  }

  return { allowed: false, location: null as string | null };
};

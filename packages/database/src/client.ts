import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __trakyahaberPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__trakyahaberPrisma ??
  new PrismaClient({
    log: ["warn", "error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__trakyahaberPrisma = prisma;
}

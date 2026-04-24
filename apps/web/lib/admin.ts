import { prisma } from "@trakyahaber/database";
import type { UserRole } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { fail } from "@/lib/api";

const memoryStore = new Map<string, { count: number; resetAt: number }>();

export async function requireApiRole(allowed: UserRole[]) {
  const session = await getAuthSession();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user) return { error: fail(401, "AUTHENTICATION_REQUIRED", "Giriş gerekli") };
  if (!role || !allowed.includes(role)) return { error: fail(403, "FORBIDDEN", "Yetkiniz yok") };
  return { user: session.user };
}

export function rateLimit(key: string, limit = 120, windowMs = 60_000) {
  const now = Date.now();
  const current = memoryStore.get(key);
  if (!current || current.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  memoryStore.set(key, current);
  return current.count <= limit;
}

export async function getSetting(key: string, fallback: unknown) {
  const found = await prisma.systemSetting.findUnique({ where: { key } });
  return found?.value ?? fallback;
}

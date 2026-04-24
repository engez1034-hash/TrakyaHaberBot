import crypto from "node:crypto";
import { prisma } from "@trakyahaber/database";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";

const verifySignature = async (rawBody: string, signatureHeader: string | null) => {
  if (!META_APP_SECRET) return false;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const signature = signatureHeader.slice(7);
  const expected = crypto.createHmac("sha256", META_APP_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return Response.json({ ok: false, error: "verification_failed" }, { status: 403 });
}

export async function POST(req: Request) {
  const signature = req.headers.get("x-hub-signature-256");
  const rawBody = await req.text();
  const isValid = await verifySignature(rawBody, signature);
  if (!isValid) {
    return Response.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    object?: string;
    entry?: Array<{ id?: string; changes?: Array<{ field?: string; value?: unknown }> }>;
  };

  const platform = payload.object === "instagram" ? "instagram" : "facebook";
  const events = payload.entry ?? [];

  for (const entry of events) {
    const dedupeId = entry.id ?? crypto.createHash("sha256").update(JSON.stringify(entry)).digest("hex");
    const existing = await prisma.webhookEvent.findFirst({
      where: { eventType: dedupeId, platform: platform as any }
    });
    if (existing) continue;

    await prisma.webhookEvent.create({
      data: {
        platform: platform as any,
        eventType: dedupeId,
        payload: entry as unknown as object,
        signature,
        processed: true,
        processedAt: new Date()
      }
    });
  }

  return Response.json({ ok: true });
}

export const runtime = "nodejs";

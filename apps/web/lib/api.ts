import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

type Meta = {
  cursor?: string;
  nextCursor?: string | null;
  hasMore?: boolean;
  total?: number;
  limit?: number;
};

export function ok<T>(data: T, init?: { status?: number; meta?: Meta }) {
  return NextResponse.json(
    {
      success: true as const,
      data,
      meta: init?.meta,
      requestId: randomUUID(),
      timestamp: new Date().toISOString()
    },
    { status: init?.status ?? 200 }
  );
}

export function fail(
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false as const,
      error: {
        code,
        message,
        details,
        statusCode
      },
      requestId: randomUUID(),
      timestamp: new Date().toISOString()
    },
    { status: statusCode }
  );
}

export function parseCursor(cursor: string | null) {
  if (!cursor) return undefined;
  return cursor;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const result: {
    status: "ok" | "error";
    db: "ok" | "error";
    env: boolean;
    error?: string;
    timestamp: string;
  } = {
    status: "ok",
    db: "error",
    env: !!process.env.DATABASE_URL,
    timestamp: new Date().toISOString(),
  };

  if (!process.env.DATABASE_URL) {
    result.status = "error";
    result.error = "DATABASE_URL is not set";
    return NextResponse.json(result, { status: 503 });
  }

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    result.db = "ok";
  } catch (e) {
    result.status = "error";
    result.error = e instanceof Error ? e.message : "Unknown DB error";
    return NextResponse.json(result, { status: 503 });
  }

  return NextResponse.json(result);
}

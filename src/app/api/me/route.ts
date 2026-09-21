import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { ensureSeeded, getConfig } from "@/lib/repo";
import { getCurrentStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const [student, config] = await Promise.all([getCurrentStudent(), getConfig()]);
  return NextResponse.json({ student, demoMode: isDemoMode(), config });
}

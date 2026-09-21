import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";
import { ensureSeeded, listStudents } from "@/lib/repo";
import { setSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function readUsername(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>).username;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo sign-in is only available in demo mode" }, { status: 400 });
  }

  const body: unknown = await request.json().catch(() => null);
  const username = readUsername(body);
  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  await ensureSeeded();
  const students = await listStudents();
  const student = students.find((s) => s.username.toLowerCase() === username.toLowerCase());
  if (!student) {
    return NextResponse.json({ error: `Unknown student "${username}"` }, { status: 404 });
  }

  await setSession(student.gitlabUserId);
  return NextResponse.json({ ok: true, student });
}

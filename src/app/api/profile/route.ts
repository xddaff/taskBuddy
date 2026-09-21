import { NextResponse } from "next/server";
import { setStudentSkills } from "@/lib/repo";
import { getCurrentStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to the empty body, which fails validation below.
  }
  return {};
}

export async function POST(request: Request) {
  const current = await getCurrentStudent();
  if (!current) {
    return NextResponse.json({ error: "Sign in to update your skills" }, { status: 401 });
  }

  const body = await readBody(request);
  if (!Array.isArray(body.skills)) {
    return NextResponse.json({ error: "Expected { skills: string[] }" }, { status: 400 });
  }
  const skills = body.skills.filter((skill): skill is string => typeof skill === "string");

  const student = await setStudentSkills(current.gitlabUserId, skills);
  return NextResponse.json({ ok: true, student });
}

import { NextResponse } from "next/server";
import { getCategorizer } from "@/lib/ai";
import { ensureSeeded, recategorizeAllIssues } from "@/lib/repo";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST() {
  const current = await getCurrentStudent();
  if (!current) {
    return NextResponse.json({ error: "Sign in to categorize tasks" }, { status: 401 });
  }
  if (!isMaintainer(current)) {
    return NextResponse.json(
      { error: "Only instructors can re-run categorization" },
      { status: 403 },
    );
  }

  try {
    await ensureSeeded();
    const result = await recategorizeAllIssues();
    return NextResponse.json({ ok: true, categorizer: getCategorizer().name, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Categorization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

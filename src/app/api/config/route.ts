import { NextResponse } from "next/server";
import { setMinParticipationPct } from "@/lib/repo";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer } from "@/lib/types";

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

function toPct(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

export async function POST(request: Request) {
  const current = await getCurrentStudent();
  if (!current) {
    return NextResponse.json({ error: "Sign in to change the target" }, { status: 401 });
  }
  if (!isMaintainer(current)) {
    return NextResponse.json(
      { error: "Only instructors can change the participation target" },
      { status: 403 },
    );
  }

  const pct = toPct((await readBody(request)).minParticipationPct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return NextResponse.json(
      { error: "minParticipationPct must be a number between 0 and 100" },
      { status: 400 },
    );
  }

  const config = await setMinParticipationPct(pct);
  return NextResponse.json({ ok: true, config });
}

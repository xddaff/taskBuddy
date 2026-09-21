import { NextResponse } from "next/server";
import { syncFromGitLab } from "@/lib/gitlab/sync";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncFromGitLab();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

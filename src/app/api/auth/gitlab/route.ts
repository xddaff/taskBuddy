import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { buildAuthorizeUrl, OAUTH_STATE_COOKIE } from "@/lib/gitlab/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ error: "GitLab sign-in is disabled in demo mode" }, { status: 400 });
  }

  const state = crypto.randomUUID();
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}

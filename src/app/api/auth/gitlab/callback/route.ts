import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";
import { fetchCurrentUser, fetchProjectMembers } from "@/lib/gitlab/client";
import { exchangeCodeForToken, OAUTH_STATE_COOKIE } from "@/lib/gitlab/oauth";
import { resolveProjectId, syncFromGitLab } from "@/lib/gitlab/sync";
import { upsertStudents } from "@/lib/repo";
import { setSession } from "@/lib/session";
import { ACCESS_LEVEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  try {
    if (isDemoMode()) throw new Error("GitLab sign-in is disabled in demo mode");

    const oauthError = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");
    if (oauthError) throw new Error(oauthError);

    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    if (!code) throw new Error("Missing authorization code");

    const jar = await cookies();
    const expectedState = jar.get(OAUTH_STATE_COOKIE)?.value;
    if (!state || !expectedState || state !== expectedState) {
      throw new Error("Invalid OAuth state");
    }
    jar.delete(OAUTH_STATE_COOKIE);

    const token = await exchangeCodeForToken(code);
    const user = await fetchCurrentUser(token);

    const projectId = await resolveProjectId();
    const members = await fetchProjectMembers(projectId, token);
    const accessLevel =
      members.find((member) => member.gitlabUserId === user.id)?.accessLevel ??
      ACCESS_LEVEL.DEVELOPER;

    await upsertStudents([
      {
        gitlabUserId: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatar_url,
        accessLevel,
      },
    ]);
    await setSession(user.id, token);
    await syncFromGitLab(token);

    return NextResponse.redirect(new URL("/dashboard", requestUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitLab sign-in failed";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, requestUrl));
  }
}

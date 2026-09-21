import { GITLAB_APP_ID, GITLAB_APP_SECRET, GITLAB_URL } from "@/lib/env";

export const OAUTH_STATE_COOKIE = "tb_oauth_state";

function redirectUri(): string {
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${appUrl}/api/auth/gitlab/callback`;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITLAB_APP_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    state,
    scope: "api",
  });
  return `${GITLAB_URL}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch(`${GITLAB_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GITLAB_APP_ID,
      client_secret: GITLAB_APP_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `GitLab token exchange failed with ${response.status} ${response.statusText}: ${body}`,
    );
  }
  const parsed = JSON.parse(body) as { access_token?: unknown };
  if (typeof parsed.access_token !== "string" || !parsed.access_token) {
    throw new Error("GitLab token exchange returned no access token");
  }
  return parsed.access_token;
}

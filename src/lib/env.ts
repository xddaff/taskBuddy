export const GITLAB_URL = process.env.GITLAB_URL?.replace(/\/$/, "") || "https://gitlab.com";
export const GITLAB_APP_ID = process.env.GITLAB_APP_ID || "";
export const GITLAB_APP_SECRET = process.env.GITLAB_APP_SECRET || "";
export const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID || "";

/**
 * Demo mode lets the app run without GitLab credentials: fixtures stand in for
 * the project members and issues, and login becomes a student picker.
 */
export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.DEMO_MODE === "false") return false;
  return !(GITLAB_APP_ID && GITLAB_APP_SECRET && GITLAB_PROJECT_ID);
}

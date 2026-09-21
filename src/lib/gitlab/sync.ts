import { GITLAB_PROJECT_ID, isDemoMode } from "@/lib/env";
import { fetchProjectIssues, fetchProjectMembers } from "@/lib/gitlab/client";
import {
  ensureSeeded,
  getConfig,
  listIssues,
  listStudents,
  upsertIssues,
  upsertStudents,
} from "@/lib/repo";
import { getAccessToken } from "@/lib/session";

export type SyncResult = {
  students: number;
  issues: number;
  source: "gitlab" | "demo";
};

export async function resolveProjectId(): Promise<string> {
  const config = await getConfig();
  const projectId = config.gitlabProjectId || GITLAB_PROJECT_ID;
  if (!projectId) throw new Error("No GitLab project configured");
  return projectId;
}

/**
 * `accessToken` is only needed by the OAuth callback, which holds a fresh token
 * before the session cookie is readable on a later request.
 */
export async function syncFromGitLab(accessToken?: string): Promise<SyncResult> {
  if (isDemoMode()) {
    await ensureSeeded();
    const [students, issues] = await Promise.all([listStudents(), listIssues()]);
    return { students: students.length, issues: issues.length, source: "demo" };
  }

  const projectId = await resolveProjectId();
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error("No GitLab access token in session");

  const [members, issues] = await Promise.all([
    fetchProjectMembers(projectId, token),
    fetchProjectIssues(projectId, token),
  ]);

  await upsertStudents(
    members.map((member) => ({
      gitlabUserId: member.gitlabUserId,
      username: member.username,
      name: member.name,
      avatarUrl: member.avatarUrl,
      accessLevel: member.accessLevel,
    })),
  );
  await upsertIssues(issues);

  return { students: members.length, issues: issues.length, source: "gitlab" };
}

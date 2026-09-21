import { GITLAB_URL } from "@/lib/env";
import type { Issue, IssueState, Student } from "@/lib/types";

const PER_PAGE = 100;
const MAX_PAGES = 100;

type GitLabUser = {
  id: number;
  username: string;
  name: string;
  avatar_url: string | null;
};

type GitLabMember = GitLabUser & { access_level: number };

type GitLabIssue = {
  iid: number;
  title: string;
  description: string | null;
  state: string;
  labels: string[];
  assignees: Array<{ id: number }>;
  web_url: string;
};

function apiUrl(path: string, query: Record<string, string> = {}): string {
  const search = new URLSearchParams(query).toString();
  return `${GITLAB_URL}/api/v4${path}${search ? `?${search}` : ""}`;
}

/** Project ids may be a numeric id or a namespaced path like `group/project`. */
function projectPath(projectId: string | number): string {
  return `/projects/${encodeURIComponent(String(projectId))}`;
}

async function request<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `GitLab ${init?.method ?? "GET"} ${url} failed with ${response.status} ${response.statusText}: ${body}`,
    );
  }
  return (await response.json()) as T;
}

async function requestAll<T>(
  path: string,
  token: string,
  query: Record<string, string> = {},
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await request<T[]>(
      apiUrl(path, { ...query, per_page: String(PER_PAGE), page: String(page) }),
      token,
    );
    items.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return items;
}

function toIssueState(state: string): IssueState {
  return state === "closed" ? "closed" : "opened";
}

function toIssue(issue: GitLabIssue): Issue {
  return {
    iid: issue.iid,
    title: issue.title,
    description: issue.description ?? "",
    state: toIssueState(issue.state),
    labels: issue.labels ?? [],
    assigneeGitlabUserIds: (issue.assignees ?? []).map((assignee) => assignee.id),
    webUrl: issue.web_url,
  };
}

export async function fetchCurrentUser(token: string): Promise<GitLabUser> {
  const user = await request<GitLabUser>(apiUrl("/user"), token);
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatar_url: user.avatar_url ?? null,
  };
}

export async function fetchProjectMembers(
  projectId: string | number,
  token: string,
): Promise<Student[]> {
  const members = await requestAll<GitLabMember>(`${projectPath(projectId)}/members/all`, token);
  return members.map((member) => ({
    gitlabUserId: member.id,
    username: member.username,
    name: member.name,
    avatarUrl: member.avatar_url ?? null,
    accessLevel: member.access_level,
    skills: [],
  }));
}

export async function fetchProjectIssues(
  projectId: string | number,
  token: string,
): Promise<Issue[]> {
  const issues = await requestAll<GitLabIssue>(`${projectPath(projectId)}/issues`, token, {
    scope: "all",
    state: "all",
  });
  return issues.map(toIssue);
}

export async function assignIssue(
  projectId: string | number,
  iid: number,
  assigneeIds: number[],
  token: string,
): Promise<Issue> {
  const issue = await request<GitLabIssue>(
    apiUrl(`${projectPath(projectId)}/issues/${iid}`),
    token,
    { method: "PUT", body: JSON.stringify({ assignee_ids: assigneeIds }) },
  );
  return toIssue(issue);
}

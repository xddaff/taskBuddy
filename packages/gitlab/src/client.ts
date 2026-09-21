import type {
  GitlabIssue,
  GitlabLanguages,
  GitlabProject,
  GitlabUser,
} from './types.js';

export class GitlabError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = 'GitlabError';
  }

  /// Distinguishes "your token is wrong" from "that project is gone", which
  /// need very different responses from the indexer.
  get isAuthFailure(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isMissing(): boolean {
    return this.status === 404;
  }
}

export interface GitlabClientOptions {
  /// Instance root, e.g. https://gitlab.example.edu. Configurable so the same
  /// code runs against gitlab.com during development.
  baseUrl: string;
  /// Personal, project or group access token with at least `read_api`.
  token: string;
  /// Per-page size for list endpoints. GitLab caps this at 100.
  perPage?: number;
  fetchImpl?: typeof fetch;
}

const MAX_RETRIES = 4;

export class GitlabClient {
  private readonly apiRoot: string;
  private readonly token: string;
  private readonly perPage: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GitlabClientOptions) {
    this.apiRoot = `${options.baseUrl.replace(/\/+$/, '')}/api/v4`;
    this.token = options.token;
    this.perPage = Math.min(options.perPage ?? 100, 100);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async currentUser(): Promise<GitlabUser> {
    return this.request<GitlabUser>('/user');
  }

  /// Projects in a group, including subgroups. Archived projects and projects
  /// with issues disabled are dropped here rather than downstream, since they
  /// can never produce a recommendable task.
  async groupProjects(group: string): Promise<GitlabProject[]> {
    const projects = await this.paginate<GitlabProject>(
      `/groups/${encodeURIComponent(group)}/projects`,
      { include_subgroups: 'true', archived: 'false', with_issues_enabled: 'true' },
    );
    return projects.filter((project) => !project.archived);
  }

  async project(idOrPath: string | number): Promise<GitlabProject> {
    return this.request<GitlabProject>(`/projects/${encodeURIComponent(String(idOrPath))}`);
  }

  /// Language breakdown as percentages. Returns an empty map rather than
  /// throwing when a project has no detectable source, which is common for
  /// documentation-only student repos.
  async projectLanguages(projectId: number): Promise<GitlabLanguages> {
    try {
      return await this.request<GitlabLanguages>(`/projects/${projectId}/languages`);
    } catch (error) {
      if (error instanceof GitlabError && (error.isMissing || error.isAuthFailure)) return {};
      throw error;
    }
  }

  async projectIssues(
    projectId: number,
    options: { state?: 'opened' | 'closed' | 'all'; updatedAfter?: Date } = {},
  ): Promise<GitlabIssue[]> {
    const query: Record<string, string> = {
      state: options.state ?? 'opened',
      // Without this GitLab omits time_stats on list endpoints for some versions.
      with_labels_details: 'false',
      order_by: 'updated_at',
      sort: 'desc',
    };
    if (options.updatedAfter) {
      query.updated_after = options.updatedAfter.toISOString();
    }
    return this.paginate<GitlabIssue>(`/projects/${projectId}/issues`, query);
  }

  async issue(projectId: number, iid: number): Promise<GitlabIssue> {
    return this.request<GitlabIssue>(`/projects/${projectId}/issues/${iid}`);
  }

  private async paginate<T>(path: string, query: Record<string, string> = {}): Promise<T[]> {
    const results: T[] = [];
    let page = 1;

    // Page through using x-next-page, which GitLab sets on every list
    // response and leaves empty on the last one.
    for (;;) {
      const { body, headers } = await this.requestWithHeaders<T[]>(path, {
        ...query,
        per_page: String(this.perPage),
        page: String(page),
      });
      results.push(...body);

      const next = headers.get('x-next-page');
      if (!next) break;
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed <= page) break;
      page = parsed;
    }

    return results;
  }

  private async request<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const { body } = await this.requestWithHeaders<T>(path, query);
    return body;
  }

  private async requestWithHeaders<T>(
    path: string,
    query: Record<string, string> = {},
  ): Promise<{ body: T; headers: Headers }> {
    const url = new URL(`${this.apiRoot}${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.fetchImpl(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
          },
        });

        if (response.status === 429 || response.status >= 500) {
          // GitLab sends Retry-After on rate limits; honour it rather than
          // guessing, and fall back to exponential backoff for 5xx.
          const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
          const waitMs = Number.isFinite(retryAfter)
            ? retryAfter * 1000
            : 1000 * Math.pow(2, attempt);
          if (attempt < MAX_RETRIES) {
            await delay(waitMs);
            continue;
          }
        }

        if (!response.ok) {
          throw new GitlabError(
            `GitLab ${response.status} for ${path}: ${await safeBody(response)}`,
            response.status,
            path,
          );
        }

        return { body: (await response.json()) as T, headers: response.headers };
      } catch (error) {
        // A GitlabError is a decided outcome, not a transport failure; only
        // network-level errors are worth retrying.
        if (error instanceof GitlabError) throw error;
        lastError = error;
        if (attempt < MAX_RETRIES) {
          await delay(1000 * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw new GitlabError(
      `GitLab request to ${path} failed after ${MAX_RETRIES + 1} attempts: ${String(lastError)}`,
      0,
      path,
    );
  }
}

async function safeBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return '<unreadable body>';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

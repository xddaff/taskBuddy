import { GitlabClient, GitlabError } from '@studentproj/gitlab';
import { syncTaxonomy } from './tags';
import { upsertProjectWithIssues } from './issues';

export interface CrawlOptions {
  baseUrl: string;
  token: string;
  /// Group paths or numeric ids to index, e.g. ["cs-department/web-projects"].
  groups: string[];
  /// Only fetch issues touched since this point. Omit for a full resync.
  updatedAfter?: Date;
  onProgress?: (message: string) => void;
}

export interface CrawlResult {
  projectsIndexed: number;
  issuesIndexed: number;
  errors: string[];
}

/// Crawls the curated GitLab groups into the local index.
///
/// Runs with a group access token rather than per-student tokens: a student's
/// token only sees what that student can see, which makes a shared
/// recommendation index impossible to build from it.
export async function crawlGroups(options: CrawlOptions): Promise<CrawlResult> {
  const log = options.onProgress ?? (() => {});
  const client = new GitlabClient({ baseUrl: options.baseUrl, token: options.token });

  const result: CrawlResult = { projectsIndexed: 0, issuesIndexed: 0, errors: [] };

  await syncTaxonomy();
  log(`Taxonomy synced.`);

  // Fail loudly and early on a bad token rather than reporting an empty index,
  // which looks identical to "the groups have no issues".
  try {
    const user = await client.currentUser();
    log(`Authenticated to ${options.baseUrl} as ${user.username}.`);
  } catch (error) {
    if (error instanceof GitlabError && error.isAuthFailure) {
      throw new Error(
        `GitLab rejected GITLAB_INDEX_TOKEN (${error.status}). It needs at least the read_api scope.`,
      );
    }
    throw error;
  }

  for (const group of options.groups) {
    let projects;
    try {
      projects = await client.groupProjects(group);
    } catch (error) {
      // One unreachable group should not abandon the others.
      result.errors.push(`group ${group}: ${describeError(error)}`);
      continue;
    }

    log(`Group ${group}: ${projects.length} projects.`);

    for (const project of projects) {
      try {
        const [languages, openIssues] = await Promise.all([
          client.projectLanguages(project.id),
          client.projectIssues(project.id, {
            state: 'opened',
            updatedAfter: options.updatedAfter,
          }),
        ]);

        const { issueCount } = await upsertProjectWithIssues({ project, languages, openIssues });
        result.projectsIndexed += 1;
        result.issuesIndexed += issueCount;
        log(`  ${project.path_with_namespace}: ${issueCount} open issues.`);
      } catch (error) {
        result.errors.push(`project ${project.path_with_namespace}: ${describeError(error)}`);
      }
    }
  }

  return result;
}

export function parseGroupList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

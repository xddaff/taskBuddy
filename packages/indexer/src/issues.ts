import { prisma } from '@studentproj/db';
import {
  computeProjectHealth,
  type GitlabIssue,
  type GitlabLanguages,
  type GitlabProject,
} from '@studentproj/gitlab';
import { deriveEstimatedHours, extractIssueTags } from '@studentproj/scoring';
import { tagIdsBySlug } from './tags';

export interface UpsertProjectInput {
  project: GitlabProject;
  languages: GitlabLanguages;
  openIssues: GitlabIssue[];
}

/// Writes a project and its open issues into the index.
///
/// Tags are derived here rather than at query time so the feed and the chat
/// suggestions both read precomputed tags, and so changing the extractor is a
/// reindex rather than a change in behaviour under the user's feet.
export async function upsertProjectWithIssues(input: UpsertProjectInput): Promise<{
  projectId: string;
  issueCount: number;
}> {
  const { project, languages, openIssues } = input;
  const health = computeProjectHealth({
    lastActivityAt: project.last_activity_at ? new Date(project.last_activity_at) : null,
    openIssues,
  });

  const record = await prisma.gitlabProject.upsert({
    where: { gitlabId: project.id },
    create: {
      gitlabId: project.id,
      pathWithNamespace: project.path_with_namespace,
      name: project.name,
      description: project.description,
      webUrl: project.web_url,
      avatarUrl: project.avatar_url,
      starCount: project.star_count ?? 0,
      lastActivityAt: project.last_activity_at ? new Date(project.last_activity_at) : null,
      languages: languages as object,
      openIssueCount: health.openIssueCount,
      medianIssueAgeDays: health.medianIssueAgeDays,
      healthScore: health.score,
    },
    update: {
      pathWithNamespace: project.path_with_namespace,
      name: project.name,
      description: project.description,
      webUrl: project.web_url,
      avatarUrl: project.avatar_url,
      starCount: project.star_count ?? 0,
      lastActivityAt: project.last_activity_at ? new Date(project.last_activity_at) : null,
      languages: languages as object,
      openIssueCount: health.openIssueCount,
      medianIssueAgeDays: health.medianIssueAgeDays,
      healthScore: health.score,
      indexedAt: new Date(),
    },
  });

  const tagIds = await tagIdsBySlug();
  for (const issue of openIssues) {
    await upsertIssue({ projectRecordId: record.id, issue, languages, tagIds });
  }

  // Issues closed on GitLab since the last crawl are no longer candidates.
  // Mark rather than delete, so a Recommendation still has something to point
  // at and the feed can explain why an item disappeared.
  const seenGitlabIds = openIssues.map((issue) => issue.id);
  await prisma.gitlabIssue.updateMany({
    where: {
      projectId: record.id,
      state: 'opened',
      ...(seenGitlabIds.length > 0 ? { gitlabId: { notIn: seenGitlabIds } } : {}),
    },
    data: { state: 'closed' },
  });

  return { projectId: record.id, issueCount: openIssues.length };
}

interface UpsertIssueInput {
  projectRecordId: string;
  issue: GitlabIssue;
  languages: GitlabLanguages;
  tagIds: Map<string, string>;
}

export async function upsertIssue(input: UpsertIssueInput): Promise<string> {
  const { projectRecordId, issue, languages, tagIds } = input;

  const timeEstimateSeconds = issue.time_stats?.time_estimate ?? null;
  const estimatedHours = deriveEstimatedHours({
    timeEstimateSeconds,
    weight: issue.weight,
  });

  const fields = {
    iid: issue.iid,
    projectId: projectRecordId,
    title: issue.title,
    description: issue.description,
    state: issue.state,
    webUrl: issue.web_url,
    labels: issue.labels ?? [],
    weight: issue.weight,
    timeEstimateSeconds,
    estimatedHours,
    assigneeCount: issue.assignees?.length ?? 0,
    authorUsername: issue.author?.username ?? null,
    gitlabCreatedAt: new Date(issue.created_at),
    gitlabUpdatedAt: new Date(issue.updated_at),
    indexedAt: new Date(),
  };

  const record = await prisma.gitlabIssue.upsert({
    where: { gitlabId: issue.id },
    create: { gitlabId: issue.id, ...fields },
    update: fields,
  });

  const extracted = extractIssueTags({
    labels: issue.labels ?? [],
    title: issue.title,
    description: issue.description ?? undefined,
    languages,
  });

  // Replace rather than merge: re-running the extractor after a label is
  // removed upstream must not leave the old tag behind.
  await prisma.issueTag.deleteMany({ where: { issueId: record.id } });
  const rows = extracted
    .map((tag) => ({
      issueId: record.id,
      tagId: tagIds.get(tag.slug),
      weight: tag.weight,
      source: tag.source,
    }))
    .filter((row): row is { issueId: string; tagId: string; weight: number; source: 'LABEL' | 'LANGUAGE' | 'TITLE' } =>
      Boolean(row.tagId),
    );

  if (rows.length > 0) {
    await prisma.issueTag.createMany({ data: rows, skipDuplicates: true });
  }

  return record.id;
}

import { prisma } from '@studentproj/db';
import { GitlabClient, type GitlabIssueEvent } from '@studentproj/gitlab';
import { upsertIssue } from './issues.js';
import { tagIdsBySlug } from './tags.js';

export interface WebhookResult {
  handled: boolean;
  reason?: string;
}

/// Refreshes a single indexed issue in response to a GitLab `issue` webhook.
///
/// The webhook payload is not trusted as the source of truth: it carries a
/// slightly different shape to the REST issue and omits fields the index needs
/// (time_stats in particular). Instead it is treated purely as a signal to
/// re-fetch that one issue, which also means one handler covers open, close,
/// relabel and reassign without branching on `action`.
export async function applyIssueEvent(
  event: GitlabIssueEvent,
  options: { baseUrl: string; token: string },
): Promise<WebhookResult> {
  if (event.object_kind !== 'issue') {
    return { handled: false, reason: `ignored object_kind ${event.object_kind}` };
  }

  const project = await prisma.gitlabProject.findUnique({
    where: { gitlabId: event.project.id },
  });

  // Only projects already in the curated index are accepted. Otherwise anyone
  // who can add a webhook could inject arbitrary tasks into the feed.
  if (!project) {
    return { handled: false, reason: `project ${event.project.id} is not indexed` };
  }

  const client = new GitlabClient({ baseUrl: options.baseUrl, token: options.token });
  const issue = await client.issue(event.project.id, event.object_attributes.iid);

  const languages = (project.languages ?? {}) as Record<string, number>;
  await upsertIssue({
    projectRecordId: project.id,
    issue,
    languages,
    tagIds: await tagIdsBySlug(),
  });

  return { handled: true };
}

/// Constant-time comparison of the webhook secret. GitLab sends it verbatim in
/// X-Gitlab-Token, so a naive equality check would leak it by timing.
export function verifyWebhookToken(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

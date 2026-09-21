import { prisma } from '@studentproj/db';
import {
  readConversationContext,
  suggestTasksForConversation,
  type ConversationContext,
} from '@studentproj/scoring';
import { assertMembership } from './messages';

/// How many recent messages define "what this conversation is about".
///
/// A rolling window rather than the latest message: suggesting from one message
/// makes the panel flicker on every send, and a single mention of a technology
/// is not context.
const CONTEXT_WINDOW = 25;

export interface SuggestedTask {
  issueId: string;
  title: string;
  webUrl: string;
  projectPath: string;
  labels: string[];
  estimatedHours: number | null;
  relevance: number;
  matchedTags: string[];
  reason: string;
}

export interface SuggestionsResult {
  topics: string[];
  confident: boolean;
  tasks: SuggestedTask[];
}

/// Ranks indexed GitLab issues against what a conversation is currently about.
///
/// Reuses the same tag vectors and cosine similarity as the personal task
/// feed; only the query side differs, coming from message text rather than a
/// student profile.
export async function suggestTasksForChat(input: {
  conversationId: string;
  userId: string;
  limit?: number;
}): Promise<SuggestionsResult> {
  await assertMembership(input.conversationId, input.userId);

  const recent = await prisma.message.findMany({
    where: { conversationId: input.conversationId, deletedAt: null, kind: 'TEXT' },
    orderBy: { createdAt: 'desc' },
    take: CONTEXT_WINDOW,
    select: { body: true },
  });

  // listMessages returns newest-first; extraction weights by recency assuming
  // oldest-first.
  const context = readConversationContext(recent.reverse());
  if (!context.confident) {
    return { topics: context.topics, confident: false, tasks: [] };
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { workspace: { select: { gitlabProjectIds: true } } },
  });

  // When the workspace declares which GitLab projects it works on, suggestions
  // are scoped to them: a team wants tasks on their own project, not anything
  // on the instance that happens to mention Docker. Unscoped workspaces and
  // DMs fall back to the whole index.
  const projectIds = conversation?.workspace?.gitlabProjectIds ?? [];

  const candidates = await prisma.gitlabIssue.findMany({
    where: {
      state: 'opened',
      ...(projectIds.length > 0 ? { project: { gitlabId: { in: projectIds } } } : {}),
    },
    orderBy: { gitlabUpdatedAt: 'desc' },
    take: 500,
    include: {
      tags: { include: { tag: { select: { slug: true } } } },
      project: { select: { pathWithNamespace: true } },
    },
  });

  const dismissed = await prisma.suggestionDismissal.findMany({
    where: { conversationId: input.conversationId },
    select: { issueId: true },
  });

  const ranked = suggestTasksForConversation(
    context,
    candidates.map((issue) => ({
      id: issue.id,
      tags: issue.tags.map((tag) => ({ slug: tag.tag.slug, weight: tag.weight })),
      updatedAt: issue.gitlabUpdatedAt,
      state: issue.state,
      assigneeCount: issue.assigneeCount,
    })),
    {
      limit: input.limit ?? 3,
      // Dismissals are per conversation, not per user: if the team rejected a
      // suggestion, nobody in it wants to keep seeing it.
      excludeIssueIds: dismissed.map((row) => row.issueId),
    },
  );

  const byId = new Map(candidates.map((issue) => [issue.id, issue]));

  return {
    topics: context.topics,
    confident: true,
    tasks: ranked.flatMap((suggestion) => {
      const issue = byId.get(suggestion.issue.id);
      if (!issue) return [];
      return [
        {
          issueId: issue.id,
          title: issue.title,
          webUrl: issue.webUrl,
          projectPath: issue.project.pathWithNamespace,
          labels: issue.labels,
          estimatedHours: issue.estimatedHours,
          relevance: suggestion.relevance,
          matchedTags: suggestion.matchedTags,
          reason: suggestion.reason,
        },
      ];
    }),
  };
}

export async function dismissSuggestion(input: {
  conversationId: string;
  issueId: string;
  userId: string;
}): Promise<void> {
  await assertMembership(input.conversationId, input.userId);

  await prisma.suggestionDismissal.upsert({
    where: {
      conversationId_issueId_userId: {
        conversationId: input.conversationId,
        issueId: input.issueId,
        userId: input.userId,
      },
    },
    create: { ...input },
    update: {},
  });
}

/// Issues matching a free-text query, for the /task slash command.
export async function findIssuesForCommand(input: {
  query: string;
  limit?: number;
}): Promise<SuggestedTask[]> {
  const query = input.query.trim();
  if (!query) return [];

  const issues = await prisma.gitlabIssue.findMany({
    where: {
      state: 'opened',
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { labels: { has: query.toLowerCase() } },
      ],
    },
    orderBy: { gitlabUpdatedAt: 'desc' },
    take: input.limit ?? 8,
    include: { project: { select: { pathWithNamespace: true } } },
  });

  return issues.map((issue) => ({
    issueId: issue.id,
    title: issue.title,
    webUrl: issue.webUrl,
    projectPath: issue.project.pathWithNamespace,
    labels: issue.labels,
    estimatedHours: issue.estimatedHours,
    relevance: 1,
    matchedTags: [],
    reason: '',
  }));
}

export type { ConversationContext };

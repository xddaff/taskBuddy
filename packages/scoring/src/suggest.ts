import { extractConversationTags } from './extract';
import { freshness } from './effort';
import { tagLabel } from './taxonomy';
import { clamp01, cosineSimilarity, overlappingTags, toVector } from './vector';

export interface SuggestionCandidate {
  id: string;
  tags: Array<{ slug: string; weight: number }>;
  updatedAt: Date;
  state: string;
  assigneeCount?: number;
}

export interface TaskSuggestion<T> {
  issue: T;
  relevance: number;
  matchedTags: string[];
  reason: string;
}

/// Relevance to the conversation dominates. Freshness only breaks ties
/// between tasks that are equally on-topic.
const SUGGESTION_WEIGHTS = {
  topicMatch: 0.85,
  freshness: 0.15,
} as const;

/// A suggestion panel that fires on weak matches gets collapsed once and
/// never reopened, so the bar to appear at all is deliberately high.
export const SUGGESTION_CONFIDENCE_THRESHOLD = 0.35;

/// At least this many distinct taxonomy tags must be recoverable from the
/// conversation before suggesting anything. One stray mention of "docker" in
/// a thread about lunch is not context.
export const MIN_CONVERSATION_TAGS = 2;

export interface ConversationContext {
  tags: Array<{ slug: string; weight: number }>;
  /// Human-readable summary of what the conversation looks to be about.
  topics: string[];
  confident: boolean;
}

export function readConversationContext(
  messages: Array<{ body: string }>,
  options: { halfLifeMessages?: number } = {},
): ConversationContext {
  const tags = extractConversationTags(messages, options);
  return {
    tags,
    topics: tags.slice(0, 3).map((tag) => tagLabel(tag.slug)),
    confident: tags.length >= MIN_CONVERSATION_TAGS,
  };
}

/// Ranks indexed issues against what a conversation is currently about.
///
/// This reuses the same tag vectors and cosine similarity as the personal task
/// feed; only the query side differs, coming from message text instead of a
/// student profile.
export function suggestTasksForConversation<T extends SuggestionCandidate>(
  context: ConversationContext,
  candidates: T[],
  options: {
    now?: Date;
    limit?: number;
    threshold?: number;
    /// Issue ids the team has already dismissed in this conversation.
    excludeIssueIds?: Iterable<string>;
  } = {},
): Array<TaskSuggestion<T>> {
  if (!context.confident) return [];

  const now = options.now ?? new Date();
  const threshold = options.threshold ?? SUGGESTION_CONFIDENCE_THRESHOLD;
  const excluded = new Set(options.excludeIssueIds ?? []);
  const contextVector = toVector(context.tags);

  const suggestions: Array<TaskSuggestion<T>> = [];

  for (const candidate of candidates) {
    if (excluded.has(candidate.id)) continue;
    if (candidate.state !== 'opened') continue;

    const issueVector = toVector(candidate.tags);
    const topicMatch = cosineSimilarity(contextVector, issueVector);
    if (topicMatch <= 0) continue;

    const relevance = clamp01(
      SUGGESTION_WEIGHTS.topicMatch * topicMatch +
        SUGGESTION_WEIGHTS.freshness * freshness(candidate.updatedAt, now),
    );
    if (relevance < threshold) continue;

    const matched = overlappingTags(contextVector, issueVector)
      .slice(0, 3)
      .map((tag) => tagLabel(tag.slug));

    suggestions.push({
      issue: candidate,
      relevance,
      matchedTags: matched,
      reason:
        matched.length > 0
          ? `You were discussing ${matched.join(', ')}`
          : 'Related to this conversation',
    });
  }

  suggestions.sort((a, b) => b.relevance - a.relevance || a.issue.id.localeCompare(b.issue.id));
  return options.limit ? suggestions.slice(0, options.limit) : suggestions;
}

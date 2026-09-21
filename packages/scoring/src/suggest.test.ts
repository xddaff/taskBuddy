import { describe, expect, it } from 'vitest';
import {
  MIN_CONVERSATION_TAGS,
  readConversationContext,
  suggestTasksForConversation,
  type SuggestionCandidate,
} from './suggest';

const NOW = new Date('2026-09-21T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

const candidates: Array<SuggestionCandidate & { title: string }> = [
  {
    id: 'docker-issue',
    title: 'Docker compose fails on first run',
    tags: [
      { slug: 'docker', weight: 1 },
      { slug: 'devops', weight: 1 },
    ],
    updatedAt: daysAgo(3),
    state: 'opened',
  },
  {
    id: 'a11y-issue',
    title: 'Add focus styles to the nav',
    tags: [
      { slug: 'accessibility', weight: 1 },
      { slug: 'css', weight: 1 },
    ],
    updatedAt: daysAgo(3),
    state: 'opened',
  },
  {
    id: 'closed-docker-issue',
    title: 'Old docker cleanup',
    tags: [
      { slug: 'docker', weight: 1 },
      { slug: 'devops', weight: 1 },
    ],
    updatedAt: daysAgo(1),
    state: 'closed',
  },
];

describe('readConversationContext', () => {
  it('reports the dominant topics', () => {
    const context = readConversationContext([
      { body: 'the docker build keeps failing' },
      { body: 'is it the devops pipeline again?' },
    ]);

    expect(context.confident).toBe(true);
    expect(context.topics).toContain('Docker');
  });

  it('is not confident from a single stray mention', () => {
    const context = readConversationContext([
      { body: 'anyone free for lunch' },
      { body: 'i am starving' },
      { body: 'docker' },
    ]);

    expect(context.tags.length).toBeLessThan(MIN_CONVERSATION_TAGS);
    expect(context.confident).toBe(false);
  });

  it('is not confident about small talk', () => {
    const context = readConversationContext([
      { body: 'hey' },
      { body: 'are we meeting tomorrow' },
      { body: 'yeah 3pm works' },
    ]);

    expect(context.confident).toBe(false);
  });
});

describe('suggestTasksForConversation', () => {
  it('surfaces tasks matching what is being discussed', () => {
    const context = readConversationContext([
      { body: 'the docker build keeps failing' },
      { body: 'is it the devops pipeline again?' },
    ]);
    const suggestions = suggestTasksForConversation(context, candidates, { now: NOW });

    expect(suggestions[0]?.issue.id).toBe('docker-issue');
    expect(suggestions[0]?.matchedTags).toContain('Docker');
    expect(suggestions[0]?.reason).toMatch(/You were discussing/);
  });

  it('does not surface unrelated tasks', () => {
    const context = readConversationContext([
      { body: 'the docker build keeps failing' },
      { body: 'is it the devops pipeline again?' },
    ]);
    const suggestions = suggestTasksForConversation(context, candidates, { now: NOW });

    expect(suggestions.map((s) => s.issue.id)).not.toContain('a11y-issue');
  });

  it('never suggests closed issues', () => {
    const context = readConversationContext([
      { body: 'the docker build keeps failing' },
      { body: 'is it the devops pipeline again?' },
    ]);
    const suggestions = suggestTasksForConversation(context, candidates, { now: NOW });

    expect(suggestions.map((s) => s.issue.id)).not.toContain('closed-docker-issue');
  });

  it('stays silent when the conversation has no technical context', () => {
    const context = readConversationContext([
      { body: 'hey' },
      { body: 'are we meeting tomorrow' },
    ]);

    expect(suggestTasksForConversation(context, candidates, { now: NOW })).toEqual([]);
  });

  it('respects dismissals so a rejected task stops coming back', () => {
    const context = readConversationContext([
      { body: 'the docker build keeps failing' },
      { body: 'is it the devops pipeline again?' },
    ]);
    const suggestions = suggestTasksForConversation(context, candidates, {
      now: NOW,
      excludeIssueIds: ['docker-issue'],
    });

    expect(suggestions.map((s) => s.issue.id)).not.toContain('docker-issue');
  });

  it('honours an explicit threshold and limit', () => {
    const context = readConversationContext([
      { body: 'the docker build keeps failing' },
      { body: 'is it the devops pipeline again?' },
    ]);

    expect(
      suggestTasksForConversation(context, candidates, { now: NOW, threshold: 0.99 }),
    ).toEqual([]);
    expect(
      suggestTasksForConversation(context, candidates, { now: NOW, threshold: 0, limit: 1 }),
    ).toHaveLength(1);
  });

  it('prefers the fresher of two equally relevant tasks', () => {
    const context = readConversationContext([
      { body: 'the docker build keeps failing' },
      { body: 'is it the devops pipeline again?' },
    ]);
    const stale: SuggestionCandidate = {
      id: 'stale-docker',
      tags: [
        { slug: 'docker', weight: 1 },
        { slug: 'devops', weight: 1 },
      ],
      updatedAt: daysAgo(365),
      state: 'opened',
    };

    const suggestions = suggestTasksForConversation(context, [stale, candidates[0]!], {
      now: NOW,
    });
    expect(suggestions[0]?.issue.id).toBe('docker-issue');
  });
});

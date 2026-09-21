import { describe, expect, it } from 'vitest';
import {
  deriveEstimatedHours,
  difficultyFit,
  effortFit,
  freshness,
  taskHourBudget,
} from './effort.js';
import { FACTOR_WEIGHTS, rankIssuesForProfile, scoreIssueForProfile } from './score.js';
import { cosineSimilarity, toVector } from './vector.js';
import type { IssueInput, ProfileInput } from './score.js';

const NOW = new Date('2026-09-21T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

const webStudent: ProfileInput = {
  skills: [
    { slug: 'typescript', proficiency: 4 },
    { slug: 'react', proficiency: 4 },
    { slug: 'css', proficiency: 3 },
  ],
  interests: ['accessibility', 'frontend'],
  weeklyHours: 6,
  commitment: 'MODERATE',
  experience: 'INTERMEDIATE',
};

const baseIssue: IssueInput = {
  tags: [],
  labels: [],
  updatedAt: daysAgo(2),
  projectHealth: 0.7,
  assigneeCount: 0,
};

describe('factor weights', () => {
  it('sum to one, so a perfect match scores 1 before penalties', () => {
    const total = Object.values(FACTOR_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical direction and 0 for disjoint tags', () => {
    const a = toVector([
      { slug: 'react', weight: 0.8 },
      { slug: 'typescript', weight: 0.8 },
    ]);
    const identical = toVector([
      { slug: 'react', weight: 0.4 },
      { slug: 'typescript', weight: 0.4 },
    ]);
    const disjoint = toVector([{ slug: 'rust', weight: 1 }]);

    expect(cosineSimilarity(a, identical)).toBeCloseTo(1, 10);
    expect(cosineSimilarity(a, disjoint)).toBe(0);
  });

  it('does not reward a student for listing many unrelated skills', () => {
    const issue = toVector([{ slug: 'react', weight: 1 }]);
    const focused = toVector([{ slug: 'react', weight: 1 }]);
    const scattergun = toVector([
      { slug: 'react', weight: 1 },
      { slug: 'rust', weight: 1 },
      { slug: 'go', weight: 1 },
      { slug: 'php', weight: 1 },
    ]);

    expect(cosineSimilarity(issue, focused)).toBeGreaterThan(cosineSimilarity(issue, scattergun));
  });

  it('is 0 when either side is empty', () => {
    expect(cosineSimilarity(toVector([]), toVector([{ slug: 'react', weight: 1 }]))).toBe(0);
  });
});

describe('effort fitting', () => {
  it('derives hours from time estimate first, then weight', () => {
    expect(deriveEstimatedHours({ timeEstimateSeconds: 7200, weight: 5 })).toBe(2);
    expect(deriveEstimatedHours({ weight: 3 })).toBe(12);
    expect(deriveEstimatedHours({})).toBeNull();
    expect(deriveEstimatedHours({ timeEstimateSeconds: 0, weight: null })).toBeNull();
  });

  it('scales the task budget with declared commitment', () => {
    expect(taskHourBudget(5, 'CASUAL')).toBe(5);
    expect(taskHourBudget(5, 'MODERATE')).toBe(10);
    expect(taskHourBudget(5, 'SERIOUS')).toBe(20);
  });

  it('peaks when the estimate matches the budget', () => {
    expect(effortFit(10, 10)).toBeCloseTo(1, 10);
    expect(effortFit(20, 10)).toBeLessThan(1);
    expect(effortFit(5, 10)).toBeLessThan(1);
  });

  it('penalises an oversized task harder than an equally undersized one', () => {
    // Both are one octave from the budget, but a task twice your budget may
    // never get finished, whereas half your budget just means doing two.
    expect(effortFit(5, 10)).toBeGreaterThan(effortFit(20, 10));
  });

  it('bottoms out beyond eight times the budget', () => {
    expect(effortFit(80, 10)).toBe(0);
    expect(effortFit(200, 10)).toBe(0);
  });

  it('keeps a small task usable rather than writing it off', () => {
    // 4x under budget still beats the neutral score given to unknown effort.
    expect(effortFit(2.5, 10)).toBeGreaterThan(0.5);
  });

  it('stays neutral when effort is unknown rather than guessing', () => {
    expect(effortFit(null, 10)).toBe(0.5);
  });
});

describe('difficultyFit', () => {
  it('lets an explicit beginner label override issue weight', () => {
    const issue = { weight: 8, labels: ['good first issue'] };
    expect(difficultyFit(issue, 'BEGINNER')).toBe(1);
    expect(difficultyFit(issue, 'ADVANCED')).toBeLessThan(0.5);
  });

  it('matches issue weight to experience level when unlabelled', () => {
    expect(difficultyFit({ weight: 2 }, 'BEGINNER')).toBeGreaterThan(
      difficultyFit({ weight: 6 }, 'BEGINNER'),
    );
    expect(difficultyFit({ weight: 6 }, 'ADVANCED')).toBeGreaterThan(
      difficultyFit({ weight: 6 }, 'BEGINNER'),
    );
  });

  it('stays neutral with no weight and no labels', () => {
    expect(difficultyFit({}, 'INTERMEDIATE')).toBe(0.5);
  });
});

describe('freshness', () => {
  it('halves every thirty days', () => {
    expect(freshness(NOW, NOW)).toBe(1);
    expect(freshness(daysAgo(30), NOW)).toBeCloseTo(0.5, 6);
    expect(freshness(daysAgo(60), NOW)).toBeCloseTo(0.25, 6);
  });
});

describe('scoreIssueForProfile', () => {
  it('ranks an on-stack, well-sized, fresh task highly', () => {
    const result = scoreIssueForProfile(
      webStudent,
      {
        ...baseIssue,
        tags: [
          { slug: 'react', weight: 1 },
          { slug: 'typescript', weight: 1 },
          { slug: 'accessibility', weight: 1 },
        ],
        labels: ['accessibility', 'frontend'],
        timeEstimateSeconds: 10 * 3600,
        weight: 3,
      },
      NOW,
    );

    expect(result.score).toBeGreaterThan(0.7);
    // Not ~1.0: the student also lists CSS and the issue also carries
    // accessibility, and those unshared dimensions pull cosine down. That is
    // the intended behaviour, not a near miss.
    expect(result.breakdown.skillMatch).toBeGreaterThan(0.7);
    expect(result.breakdown.interestMatch).toBeGreaterThan(0.4);
  });

  it('ranks an off-stack task low', () => {
    const result = scoreIssueForProfile(
      webStudent,
      {
        ...baseIssue,
        tags: [
          { slug: 'rust', weight: 1 },
          { slug: 'embedded', weight: 1 },
        ],
        labels: ['embedded'],
      },
      NOW,
    );

    expect(result.breakdown.skillMatch).toBe(0);
    expect(result.score).toBeLessThan(0.35);
  });

  it('demotes an equivalent task that someone already claimed', () => {
    const issue: IssueInput = {
      ...baseIssue,
      tags: [{ slug: 'react', weight: 1 }],
      timeEstimateSeconds: 10 * 3600,
    };

    const unclaimed = scoreIssueForProfile(webStudent, issue, NOW);
    const claimed = scoreIssueForProfile(webStudent, { ...issue, assigneeCount: 1 }, NOW);

    expect(claimed.score).toBeLessThan(unclaimed.score);
    expect(claimed.reasons).toContain('Someone is already assigned');
  });

  it('suppresses tags the student has repeatedly dismissed', () => {
    const issue: IssueInput = {
      ...baseIssue,
      tags: [{ slug: 'css', weight: 1 }],
      timeEstimateSeconds: 10 * 3600,
    };

    const neutral = scoreIssueForProfile(webStudent, issue, NOW);
    const soured = scoreIssueForProfile(
      { ...webStudent, signals: [{ slug: 'css', weight: -1 }] },
      issue,
      NOW,
    );

    expect(soured.score).toBeLessThan(neutral.score);
  });

  it('ignores positive signals in the penalty, since skills already carry them', () => {
    const issue: IssueInput = { ...baseIssue, tags: [{ slug: 'css', weight: 1 }] };
    const neutral = scoreIssueForProfile(webStudent, issue, NOW);
    const praised = scoreIssueForProfile(
      { ...webStudent, signals: [{ slug: 'css', weight: 1 }] },
      issue,
      NOW,
    );

    expect(praised.score).toBeCloseTo(neutral.score, 10);
  });

  it('never leaves the 0..1 range', () => {
    const worst = scoreIssueForProfile(
      { ...webStudent, signals: [{ slug: 'rust', weight: -10 }] },
      {
        ...baseIssue,
        tags: [{ slug: 'rust', weight: 1 }],
        updatedAt: daysAgo(900),
        projectHealth: 0,
        assigneeCount: 3,
      },
      NOW,
    );

    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(1);
  });

  it('explains itself in terms a student can act on', () => {
    const result = scoreIssueForProfile(
      webStudent,
      {
        ...baseIssue,
        tags: [
          { slug: 'react', weight: 1 },
          { slug: 'typescript', weight: 1 },
          { slug: 'accessibility', weight: 1 },
        ],
        labels: ['good first issue'],
        timeEstimateSeconds: 10 * 3600,
        updatedAt: daysAgo(1),
      },
      NOW,
    );

    expect(result.reasons.join(' | ')).toMatch(/Matches your/);
    expect(result.reasons.join(' | ')).toMatch(/React/);
    expect(result.reasons.join(' | ')).toMatch(/fits your 6h\/week/);
    expect(result.reasons).toContain('Flagged as beginner friendly');
  });

  it('does not repeat a tag in both the skill and interest reason', () => {
    const result = scoreIssueForProfile(
      { ...webStudent, interests: ['react', 'accessibility'] },
      { ...baseIssue, tags: [{ slug: 'react', weight: 1 }, { slug: 'accessibility', weight: 1 }] },
      NOW,
    );

    const interestReason = result.reasons.find((reason) => reason.startsWith('Touches'));
    expect(interestReason).not.toMatch(/React/);
  });

  it('handles a profile with no skills yet without throwing', () => {
    const result = scoreIssueForProfile(
      { skills: [], interests: [], weeklyHours: 5, commitment: 'CASUAL', experience: 'BEGINNER' },
      { ...baseIssue, tags: [{ slug: 'react', weight: 1 }] },
      NOW,
    );

    expect(result.breakdown.skillMatch).toBe(0);
    expect(result.score).toBeGreaterThan(0);
  });
});

describe('rankIssuesForProfile', () => {
  const issues = [
    {
      id: 'off-stack',
      ...baseIssue,
      tags: [{ slug: 'rust', weight: 1 }],
    },
    {
      id: 'on-stack',
      ...baseIssue,
      tags: [
        { slug: 'react', weight: 1 },
        { slug: 'typescript', weight: 1 },
      ],
      timeEstimateSeconds: 10 * 3600,
    },
    {
      id: 'on-stack-stale',
      ...baseIssue,
      tags: [
        { slug: 'react', weight: 1 },
        { slug: 'typescript', weight: 1 },
      ],
      timeEstimateSeconds: 10 * 3600,
      updatedAt: daysAgo(400),
    },
  ];

  it('orders by score and applies limits', () => {
    const ranked = rankIssuesForProfile(webStudent, issues, { now: NOW });
    expect(ranked.map((entry) => entry.issue.id)).toEqual([
      'on-stack',
      'on-stack-stale',
      'off-stack',
    ]);

    expect(rankIssuesForProfile(webStudent, issues, { now: NOW, limit: 1 })).toHaveLength(1);
  });

  it('filters below a minimum score', () => {
    const ranked = rankIssuesForProfile(webStudent, issues, { now: NOW, minScore: 0.5 });
    expect(ranked.every((entry) => entry.score >= 0.5)).toBe(true);
    expect(ranked.map((entry) => entry.issue.id)).not.toContain('off-stack');
  });

  it('is deterministic for equally scored issues', () => {
    const tied = [
      { id: 'b', ...baseIssue, tags: [{ slug: 'react', weight: 1 }] },
      { id: 'a', ...baseIssue, tags: [{ slug: 'react', weight: 1 }] },
    ];
    expect(rankIssuesForProfile(webStudent, tied, { now: NOW }).map((e) => e.issue.id)).toEqual([
      'a',
      'b',
    ]);
  });
});

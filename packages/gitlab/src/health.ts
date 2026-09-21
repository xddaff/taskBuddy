import type { GitlabIssue } from './types.js';

export interface ProjectHealth {
  /// 0..1 rollup used by the projectHealth scoring factor.
  score: number;
  openIssueCount: number;
  medianIssueAgeDays: number | null;
}

/// How responsive and alive a project looks, which is a proxy for whether a
/// student who picks up one of its issues will get a review.
///
/// Deliberately crude: it uses only what the index already fetches, and it is
/// the lowest-weighted scoring factor, so precision here matters less than not
/// steering students towards abandoned repos.
export function computeProjectHealth(
  input: { lastActivityAt: Date | null; openIssues: GitlabIssue[] },
  now: Date = new Date(),
): ProjectHealth {
  const openIssues = input.openIssues;
  const ages = openIssues
    .map((issue) => daysBetween(new Date(issue.created_at), now))
    .sort((a, b) => a - b);

  const medianIssueAgeDays = ages.length > 0 ? median(ages) : null;

  // Recent commits or issue activity. Half-life of 60 days: a project quiet
  // for a term is probably between semesters or abandoned.
  const activityScore = input.lastActivityAt
    ? Math.pow(0.5, daysBetween(input.lastActivityAt, now) / 60)
    : 0.3;

  // A backlog whose median item is a year old suggests issues get filed and
  // forgotten. 120 days is treated as the point where that becomes a concern.
  const backlogScore =
    medianIssueAgeDays === null ? 0.6 : clamp01(1 - medianIssueAgeDays / 365);

  // A project with no open issues cannot host a recommendation, but it is not
  // unhealthy; it just contributes nothing. Keep it neutral.
  const volumeScore = openIssues.length === 0 ? 0.5 : clamp01(0.5 + openIssues.length / 40);

  const score = clamp01(0.5 * activityScore + 0.3 * backlogScore + 0.2 * volumeScore);

  return {
    score,
    openIssueCount: openIssues.length,
    medianIssueAgeDays,
  };
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 86_400_000);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

import {
  deriveEstimatedHours,
  difficultyFit,
  effortFit,
  formatHours,
  freshness,
  isBeginnerFriendly,
  taskHourBudget,
  type Commitment,
  type Experience,
} from './effort';
import { tagLabel } from './taxonomy';
import { clamp01, cosineSimilarity, overlappingTags, toVector, type WeightedTag } from './vector';

/// Factor weights. Exported so they can be tuned in one place, and so tests
/// can assert the contract that they sum to 1 rather than silently drifting.
export const FACTOR_WEIGHTS = {
  skillMatch: 0.4,
  interestMatch: 0.2,
  effortFit: 0.15,
  difficultyFit: 0.1,
  freshness: 0.1,
  projectHealth: 0.05,
} as const;

export type FactorName = keyof typeof FACTOR_WEIGHTS;

/// Applied after the weighted sum rather than as a factor, because these are
/// reasons to suppress an otherwise good match, not qualities to average in.
export const PENALTIES = {
  /// Someone is already on it. Not disqualifying on student projects, where
  /// assignees often go stale, but it should lose to an unclaimed equivalent.
  alreadyAssigned: 0.25,
  /// Per unit of accumulated negative feedback on a tag, from dismissals.
  dismissedTag: 0.3,
} as const;

export interface ProfileInput {
  skills: Array<{ slug: string; proficiency: number }>;
  interests: string[];
  weeklyHours: number;
  commitment: Commitment;
  experience: Experience;
  /// Accumulated implicit feedback per tag; negative values suppress.
  signals?: Array<{ slug: string; weight: number }>;
}

export interface IssueInput {
  tags: WeightedTag[];
  labels: string[];
  timeEstimateSeconds?: number | null;
  weight?: number | null;
  assigneeCount?: number;
  updatedAt: Date;
  /// 0..1 rollup computed by the indexer.
  projectHealth?: number;
}

export type ScoreBreakdown = Record<FactorName, number> & {
  penalty: number;
  estimatedHours: number | null;
  budgetHours: number;
};

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
}

export function scoreIssueForProfile(
  profile: ProfileInput,
  issue: IssueInput,
  now: Date = new Date(),
): ScoreResult {
  const issueVector = toVector(issue.tags);

  // Proficiency is self-reported 1-5; normalising to 0..1 keeps the vector in
  // the same range as issue tag weights so cosine values stay comparable.
  const skillVector = toVector(
    profile.skills.map(({ slug, proficiency }) => ({
      slug,
      weight: clamp01(proficiency / 5),
    })),
  );
  const interestVector = toVector(profile.interests.map((slug) => ({ slug, weight: 1 })));

  const estimatedHours = deriveEstimatedHours(issue);
  const budgetHours = taskHourBudget(profile.weeklyHours, profile.commitment);

  const factors: Record<FactorName, number> = {
    skillMatch: cosineSimilarity(skillVector, issueVector),
    interestMatch: cosineSimilarity(interestVector, issueVector),
    effortFit: effortFit(estimatedHours, budgetHours),
    difficultyFit: difficultyFit(issue, profile.experience),
    freshness: freshness(issue.updatedAt, now),
    projectHealth: clamp01(issue.projectHealth ?? 0.5),
  };

  let score = 0;
  for (const name of Object.keys(FACTOR_WEIGHTS) as FactorName[]) {
    score += FACTOR_WEIGHTS[name] * factors[name];
  }

  const penalty = computePenalty(profile, issue, issueVector);
  score = clamp01(score - penalty);

  return {
    score,
    breakdown: { ...factors, penalty, estimatedHours, budgetHours },
    reasons: buildReasons({
      profile,
      issue,
      factors,
      skillVector,
      interestVector,
      issueVector,
      estimatedHours,
      now,
    }),
  };
}

function computePenalty(
  profile: ProfileInput,
  issue: IssueInput,
  issueVector: Map<string, number>,
): number {
  let penalty = 0;

  if ((issue.assigneeCount ?? 0) > 0) {
    penalty += PENALTIES.alreadyAssigned;
  }

  // Only negative signals penalise here. Positive signals already show up
  // through the skill vector, and counting them twice would let a student's
  // early clicks dominate everything they see afterwards.
  let negative = 0;
  for (const signal of profile.signals ?? []) {
    if (signal.weight >= 0) continue;
    const issueWeight = issueVector.get(signal.slug);
    if (issueWeight === undefined) continue;
    negative += Math.abs(signal.weight) * issueWeight;
  }
  penalty += Math.min(PENALTIES.dismissedTag, negative * PENALTIES.dismissedTag);

  return penalty;
}

function buildReasons(input: {
  profile: ProfileInput;
  issue: IssueInput;
  factors: Record<FactorName, number>;
  skillVector: Map<string, number>;
  interestVector: Map<string, number>;
  issueVector: Map<string, number>;
  estimatedHours: number | null;
  now: Date;
}): string[] {
  const { profile, issue, factors, skillVector, interestVector, issueVector, estimatedHours, now } =
    input;
  const reasons: string[] = [];

  const skillOverlap = overlappingTags(skillVector, issueVector).slice(0, 3);
  if (skillOverlap.length > 0) {
    reasons.push(`Matches your ${formatList(skillOverlap.map((tag) => tagLabel(tag.slug)))}`);
  }

  // Only mention interests that are not already covered by the skill reason,
  // otherwise every card repeats the same two words twice.
  const interestOverlap = overlappingTags(interestVector, issueVector)
    .filter((tag) => !skillOverlap.some((skill) => skill.slug === tag.slug))
    .slice(0, 2);
  if (interestOverlap.length > 0) {
    reasons.push(`Touches ${formatList(interestOverlap.map((tag) => tagLabel(tag.slug)))}`);
  }

  if (estimatedHours !== null) {
    const budget = taskHourBudget(profile.weeklyHours, profile.commitment);

    if (estimatedHours > budget) {
      // Never claim a task "fits" when it exceeds the budget. Translating the
      // estimate into weeks at the student's own pace is both honest and more
      // useful than a raw hour count they have to divide themselves.
      const weeks = Math.ceil(estimatedHours / Math.max(1, profile.weeklyHours));
      reasons.push(
        `About ${formatHours(estimatedHours)}, roughly ${weeks} week${weeks === 1 ? '' : 's'} at ${profile.weeklyHours}h/week`,
      );
    } else if (factors.effortFit >= 0.6) {
      reasons.push(`About ${formatHours(estimatedHours)}, fits your ${profile.weeklyHours}h/week`);
    } else if (factors.effortFit < 0.35) {
      reasons.push(`Small task, about ${formatHours(estimatedHours)}`);
    }
  }

  if (isBeginnerFriendly(issue.labels)) {
    reasons.push('Flagged as beginner friendly');
  } else if (factors.difficultyFit >= 0.8 && issue.weight) {
    reasons.push(`Sized for ${profile.experience.toLowerCase()} level`);
  }

  const ageDays = Math.floor((now.getTime() - issue.updatedAt.getTime()) / 86_400_000);
  if (ageDays <= 7) {
    reasons.push(ageDays <= 1 ? 'Updated today' : `Updated ${ageDays} days ago`);
  } else if (factors.freshness < 0.25) {
    reasons.push(`Quiet for ${Math.floor(ageDays / 30)} months`);
  }

  if ((issue.assigneeCount ?? 0) > 0) {
    reasons.push('Someone is already assigned');
  }

  return reasons;
}

function formatList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/// Ranks a set of issues for one student. Kept here so the worker, the feed
/// and the chat suggestions all order results identically.
export function rankIssuesForProfile<T extends { id: string } & IssueInput>(
  profile: ProfileInput,
  issues: T[],
  options: { now?: Date; minScore?: number; limit?: number } = {},
): Array<{ issue: T } & ScoreResult> {
  const now = options.now ?? new Date();
  const minScore = options.minScore ?? 0;

  const ranked = issues
    .map((issue) => ({ issue, ...scoreIssueForProfile(profile, issue, now) }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score || a.issue.id.localeCompare(b.issue.id));

  return options.limit ? ranked.slice(0, options.limit) : ranked;
}

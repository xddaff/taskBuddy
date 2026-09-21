import { clamp01 } from './vector.js';

export type Commitment = 'CASUAL' | 'MODERATE' | 'SERIOUS';
export type Experience = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

/// How many weeks of the student's declared availability a single task should
/// occupy. A casual contributor wants something finishable this week; someone
/// treating it as their main project can take on a month of work.
const WEEKS_PER_TASK: Record<Commitment, number> = {
  CASUAL: 1,
  MODERATE: 2,
  SERIOUS: 4,
};

/// GitLab issue weight a student at each level should be aiming at. GitLab
/// weights are conventionally 1-5 but nothing enforces that, so this is a
/// target to measure distance from rather than a filter.
const TARGET_ISSUE_WEIGHT: Record<Experience, number> = {
  BEGINNER: 2,
  INTERMEDIATE: 4,
  ADVANCED: 6,
};

const BEGINNER_FRIENDLY = [
  'good first issue',
  'good-first-issue',
  'first issue',
  'beginner',
  'beginner friendly',
  'easy',
  'starter',
  'newcomer',
  'junior',
  'low hanging fruit',
];

const ADVANCED_LABELS = ['hard', 'complex', 'advanced', 'architecture', 'epic', 'expert'];

/// The effort budget a single recommended task should fit into, in hours.
export function taskHourBudget(weeklyHours: number, commitment: Commitment): number {
  const hours = Math.max(1, weeklyHours);
  return hours * WEEKS_PER_TASK[commitment];
}

/// GitLab exposes `time_estimate` in seconds, but most student projects never
/// set it. Issue weight is the usual fallback; treat one weight point as
/// roughly half a day of student work.
export function deriveEstimatedHours(input: {
  timeEstimateSeconds?: number | null;
  weight?: number | null;
}): number | null {
  if (input.timeEstimateSeconds && input.timeEstimateSeconds > 0) {
    return input.timeEstimateSeconds / 3600;
  }
  if (input.weight && input.weight > 0) {
    return input.weight * 4;
  }
  return null;
}

/// Scored on the log of the ratio, so being 2x out costs the same whether the
/// task is 2h against a 1h budget or 40h against 20h. Both directions are
/// penalised: an oversized task is discouraging, and an undersized one is not
/// worth a semester of someone's attention.
export function effortFit(estimatedHours: number | null, budgetHours: number): number {
  if (estimatedHours === null || estimatedHours <= 0) return 0.5;
  if (budgetHours <= 0) return 0.5;

  const ratio = estimatedHours / budgetHours;
  const octaves = Math.abs(Math.log2(ratio));
  // 3 octaves out (8x too big or too small) scores zero.
  return clamp01(1 - octaves / 3);
}

export function difficultyFit(
  input: { weight?: number | null; labels?: string[] },
  experience: Experience,
): number {
  const labels = (input.labels ?? []).map((label) => label.toLowerCase().trim());
  const isBeginnerFriendly = labels.some((label) =>
    BEGINNER_FRIENDLY.some((needle) => label.includes(needle)),
  );
  const isAdvanced = labels.some((label) =>
    ADVANCED_LABELS.some((needle) => label.includes(needle)),
  );

  // An explicit maintainer signal beats anything inferred from weights.
  if (isBeginnerFriendly && !isAdvanced) {
    return experience === 'BEGINNER' ? 1 : experience === 'INTERMEDIATE' ? 0.7 : 0.4;
  }
  if (isAdvanced && !isBeginnerFriendly) {
    return experience === 'ADVANCED' ? 1 : experience === 'INTERMEDIATE' ? 0.6 : 0.2;
  }

  if (input.weight === null || input.weight === undefined || input.weight <= 0) return 0.5;

  const target = TARGET_ISSUE_WEIGHT[experience];
  return clamp01(1 - Math.abs(input.weight - target) / 6);
}

export function isBeginnerFriendly(labels: string[]): boolean {
  return labels
    .map((label) => label.toLowerCase().trim())
    .some((label) => BEGINNER_FRIENDLY.some((needle) => label.includes(needle)));
}

/// Exponential decay with a 30-day half-life. A task nobody has touched in a
/// term is usually stale rather than available.
export function freshness(updatedAt: Date, now: Date, halfLifeDays = 30): number {
  const ageMs = now.getTime() - updatedAt.getTime();
  if (ageMs <= 0) return 1;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return clamp01(Math.pow(0.5, ageDays / halfLifeDays));
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 10) return `${Math.round(hours * 2) / 2}h`;
  return `${Math.round(hours)}h`;
}

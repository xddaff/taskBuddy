import { computeParticipation, isClassMember } from "@/lib/participation";
import { describeReason, scoreIssueForStudent } from "@/lib/recommender/score";
import type { ClassPlan, Issue, Recommendation, Student } from "@/lib/types";

type Slot = {
  gitlabUserId: number;
  username: string;
  currentCount: number;
  need: number;
};

export type RecommendInput = {
  students: Student[];
  issues: Issue[];
  minParticipationPct: number;
};

function nextSlot(slots: Slot[]): Slot | null {
  let best: Slot | null = null;
  for (const slot of slots) {
    if (slot.need <= 0) continue;
    if (
      !best ||
      slot.need > best.need ||
      (slot.need === best.need &&
        (slot.currentCount < best.currentCount ||
          (slot.currentCount === best.currentCount && slot.username < best.username)))
    ) {
      best = slot;
    }
  }
  return best;
}

function bestIssueIndex(student: Student, pool: Issue[]): number {
  let bestIndex = -1;
  let bestScore = -1;
  for (let i = 0; i < pool.length; i += 1) {
    const { score } = scoreIssueForStudent(student, pool[i]);
    if (
      bestIndex === -1 ||
      score > bestScore ||
      (score === bestScore && pool[i].iid < pool[bestIndex].iid)
    ) {
      bestIndex = i;
      bestScore = score;
    }
  }
  return bestIndex;
}

export function recommend(input: RecommendInput): ClassPlan {
  const { students, issues, minParticipationPct } = input;
  const stats = computeParticipation(students, issues, minParticipationPct);
  const studentsById = new Map(students.filter(isClassMember).map((s) => [s.gitlabUserId, s]));

  // Work already owned by somebody must never be handed out again.
  const pool = issues.filter(
    (issue) => issue.state === "opened" && issue.assigneeGitlabUserIds.length === 0,
  );
  const slots: Slot[] = stats.map((stat) => ({
    gitlabUserId: stat.gitlabUserId,
    username: stat.username,
    currentCount: stat.currentCount,
    need: stat.need,
  }));

  const recommendations: Recommendation[] = [];
  const ranks = new Map<number, number>();

  while (pool.length > 0) {
    const slot = nextSlot(slots);
    if (!slot) break;
    const student = studentsById.get(slot.gitlabUserId);
    if (!student) {
      slot.need = 0;
      continue;
    }

    const index = bestIssueIndex(student, pool);
    const [issue] = pool.splice(index, 1);
    const { score, matchedLabels, matchedCategories } = scoreIssueForStudent(student, issue);
    const rank = (ranks.get(slot.gitlabUserId) ?? 0) + 1;
    ranks.set(slot.gitlabUserId, rank);
    slot.need -= 1;

    recommendations.push({
      gitlabUserId: slot.gitlabUserId,
      issueIid: issue.iid,
      rank,
      score,
      reason: describeReason(matchedLabels, minParticipationPct, matchedCategories),
    });
  }

  const unmetNeed = slots.reduce((sum, slot) => sum + Math.max(0, slot.need), 0);
  const feasible = unmetNeed === 0;

  return {
    minParticipationPct,
    totalIssues: issues.length,
    stats,
    recommendations,
    feasible,
    warning: feasible
      ? null
      : `${unmetNeed} more open, unassigned issue${unmetNeed === 1 ? " is" : "s are"} needed for every student to reach ${minParticipationPct}% participation.`,
  };
}

export function recommendationsForStudent(
  plan: ClassPlan,
  gitlabUserId: number,
): Recommendation[] {
  return plan.recommendations
    .filter((rec) => rec.gitlabUserId === gitlabUserId)
    .sort((a, b) => a.rank - b.rank);
}

import { ACCESS_LEVEL, type Issue, type ParticipationStat, type Student } from "@/lib/types";

/** Maintainers and owners run the course, so they are outside the participation quota. */
export function isClassMember(student: Student): boolean {
  return (
    student.accessLevel >= ACCESS_LEVEL.DEVELOPER && student.accessLevel < ACCESS_LEVEL.MAINTAINER
  );
}

export function targetCountFor(totalIssues: number, minParticipationPct: number): number {
  const target = Math.ceil((minParticipationPct / 100) * totalIssues);
  return Math.min(totalIssues, Math.max(0, target));
}

function byUsername(a: { username: string }, b: { username: string }): number {
  if (a.username === b.username) return 0;
  return a.username < b.username ? -1 : 1;
}

export function computeParticipation(
  students: Student[],
  issues: Issue[],
  minParticipationPct: number,
): ParticipationStat[] {
  const totalIssues = issues.length;
  const targetCount = targetCountFor(totalIssues, minParticipationPct);

  return students
    .filter(isClassMember)
    .map((student) => {
      const currentCount = issues.filter((issue) =>
        issue.assigneeGitlabUserIds.includes(student.gitlabUserId),
      ).length;
      const need = Math.max(0, targetCount - currentCount);
      return {
        gitlabUserId: student.gitlabUserId,
        username: student.username,
        name: student.name,
        currentCount,
        totalIssues,
        pct: totalIssues === 0 ? 0 : Math.round((currentCount / totalIssues) * 1000) / 10,
        targetCount,
        need,
        meetsTarget: need === 0,
      };
    })
    .sort(byUsername);
}

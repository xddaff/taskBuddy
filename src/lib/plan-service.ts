import { recommend } from "@/lib/recommender";
import { ensureIssuesCategorized, ensureSeeded, getConfig, listIssues, listStudents } from "@/lib/repo";
import type { AppConfig, ClassPlan, Issue, Student } from "@/lib/types";

export type LoadedClassPlan = {
  plan: ClassPlan;
  students: Student[];
  issues: Issue[];
  config: AppConfig;
};

export async function loadClassPlan(): Promise<LoadedClassPlan> {
  await ensureSeeded();
  await ensureIssuesCategorized();
  const [config, students, issues] = await Promise.all([getConfig(), listStudents(), listIssues()]);
  const plan = recommend({
    students,
    issues,
    minParticipationPct: config.minParticipationPct,
  });
  return { plan, students, issues, config };
}

export function issuesByIid(issues: Issue[]): Map<number, Issue> {
  return new Map(issues.map((issue) => [issue.iid, issue]));
}

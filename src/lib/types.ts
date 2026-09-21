import type { CategorySlug } from "@/lib/ai/taxonomy";

export const ACCESS_LEVEL = {
  GUEST: 10,
  REPORTER: 20,
  DEVELOPER: 30,
  MAINTAINER: 40,
  OWNER: 50,
} as const;

export type IssueState = "opened" | "closed";

export type Student = {
  gitlabUserId: number;
  username: string;
  name: string;
  avatarUrl: string | null;
  accessLevel: number;
  skills: string[];
};

/** A category the categorizer assigned to a task; never entered by a student. */
export type IssueCategory = {
  slug: CategorySlug;
  confidence: number;
  evidence: string[];
};

export type Issue = {
  iid: number;
  title: string;
  description: string;
  state: IssueState;
  labels: string[];
  assigneeGitlabUserIds: number[];
  webUrl: string;
  categories: IssueCategory[];
};

export type ParticipationStat = {
  gitlabUserId: number;
  username: string;
  name: string;
  currentCount: number;
  totalIssues: number;
  pct: number;
  targetCount: number;
  need: number;
  meetsTarget: boolean;
};

export type Recommendation = {
  gitlabUserId: number;
  issueIid: number;
  rank: number;
  score: number;
  reason: string;
};

export type ClassPlan = {
  minParticipationPct: number;
  totalIssues: number;
  stats: ParticipationStat[];
  recommendations: Recommendation[];
  feasible: boolean;
  warning: string | null;
};

export type AppConfig = {
  gitlabProjectId: string | null;
  minParticipationPct: number;
};

export function isMaintainer(student: Pick<Student, "accessLevel">): boolean {
  return student.accessLevel >= ACCESS_LEVEL.MAINTAINER;
}

export function isStudent(accessLevel: number): boolean {
  return accessLevel >= ACCESS_LEVEL.DEVELOPER;
}

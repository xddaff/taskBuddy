import { prisma } from "@/lib/db";
import { DEMO_ISSUES, DEMO_STUDENTS } from "@/lib/demo/fixtures";
import { isDemoMode, GITLAB_PROJECT_ID } from "@/lib/env";
import type { AppConfig, Issue, IssueState, Student } from "@/lib/types";

const DEFAULT_MIN_PARTICIPATION_PCT = 20;

function parseStringArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function parseNumberArray(json: string): number[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === "number") : [];
  } catch {
    return [];
  }
}

export async function getConfig(): Promise<AppConfig> {
  const row = await prisma.appConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      gitlabProjectId: GITLAB_PROJECT_ID || null,
      minParticipationPct: DEFAULT_MIN_PARTICIPATION_PCT,
    },
  });
  return {
    gitlabProjectId: row.gitlabProjectId,
    minParticipationPct: row.minParticipationPct,
  };
}

export async function setMinParticipationPct(pct: number): Promise<AppConfig> {
  const clamped = Math.min(100, Math.max(0, Math.round(pct)));
  await getConfig();
  const row = await prisma.appConfig.update({
    where: { id: 1 },
    data: { minParticipationPct: clamped },
  });
  return {
    gitlabProjectId: row.gitlabProjectId,
    minParticipationPct: row.minParticipationPct,
  };
}

export async function setGitlabProjectId(projectId: string | null): Promise<AppConfig> {
  await getConfig();
  const row = await prisma.appConfig.update({
    where: { id: 1 },
    data: { gitlabProjectId: projectId },
  });
  return {
    gitlabProjectId: row.gitlabProjectId,
    minParticipationPct: row.minParticipationPct,
  };
}

export async function listStudents(): Promise<Student[]> {
  const rows = await prisma.student.findMany({ orderBy: { username: "asc" } });
  return rows.map((row) => ({
    gitlabUserId: row.gitlabUserId,
    username: row.username,
    name: row.name,
    avatarUrl: row.avatarUrl,
    accessLevel: row.accessLevel,
    skills: parseStringArray(row.skillsJson),
  }));
}

export async function getStudent(gitlabUserId: number): Promise<Student | null> {
  const row = await prisma.student.findUnique({ where: { gitlabUserId } });
  if (!row) return null;
  return {
    gitlabUserId: row.gitlabUserId,
    username: row.username,
    name: row.name,
    avatarUrl: row.avatarUrl,
    accessLevel: row.accessLevel,
    skills: parseStringArray(row.skillsJson),
  };
}

/**
 * Upserts members pulled from GitLab. Skills are student-provided, so they are
 * only written when the caller supplies them; a sync must not wipe them.
 */
export async function upsertStudents(
  students: Array<Omit<Student, "skills"> & { skills?: string[] }>,
): Promise<void> {
  for (const student of students) {
    const skillsJson = student.skills ? JSON.stringify(student.skills) : undefined;
    await prisma.student.upsert({
      where: { gitlabUserId: student.gitlabUserId },
      update: {
        username: student.username,
        name: student.name,
        avatarUrl: student.avatarUrl,
        accessLevel: student.accessLevel,
        ...(skillsJson ? { skillsJson } : {}),
      },
      create: {
        gitlabUserId: student.gitlabUserId,
        username: student.username,
        name: student.name,
        avatarUrl: student.avatarUrl,
        accessLevel: student.accessLevel,
        skillsJson: skillsJson ?? "[]",
      },
    });
  }
}

export async function setStudentSkills(gitlabUserId: number, skills: string[]): Promise<Student> {
  const normalized = Array.from(
    new Set(skills.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0)),
  );
  const row = await prisma.student.update({
    where: { gitlabUserId },
    data: { skillsJson: JSON.stringify(normalized) },
  });
  return {
    gitlabUserId: row.gitlabUserId,
    username: row.username,
    name: row.name,
    avatarUrl: row.avatarUrl,
    accessLevel: row.accessLevel,
    skills: parseStringArray(row.skillsJson),
  };
}

export async function listIssues(): Promise<Issue[]> {
  const rows = await prisma.issue.findMany({ orderBy: { iid: "asc" } });
  return rows.map((row) => ({
    iid: row.iid,
    title: row.title,
    description: row.description,
    state: row.state as IssueState,
    labels: parseStringArray(row.labelsJson),
    assigneeGitlabUserIds: parseNumberArray(row.assigneesJson),
    webUrl: row.webUrl,
  }));
}

export async function upsertIssues(issues: Issue[]): Promise<void> {
  for (const issue of issues) {
    const data = {
      title: issue.title,
      description: issue.description,
      state: issue.state,
      labelsJson: JSON.stringify(issue.labels),
      assigneesJson: JSON.stringify(issue.assigneeGitlabUserIds),
      webUrl: issue.webUrl,
    };
    await prisma.issue.upsert({
      where: { iid: issue.iid },
      update: data,
      create: { iid: issue.iid, ...data },
    });
  }
}

export async function assignIssueLocally(iid: number, gitlabUserId: number): Promise<void> {
  const row = await prisma.issue.findUnique({ where: { iid } });
  if (!row) return;
  const assignees = new Set(parseNumberArray(row.assigneesJson));
  assignees.add(gitlabUserId);
  await prisma.issue.update({
    where: { iid },
    data: { assigneesJson: JSON.stringify([...assignees]) },
  });
}

/**
 * Seeds demo fixtures the first time the app runs without GitLab credentials so
 * the UI has something to show.
 */
export async function ensureSeeded(): Promise<void> {
  if (!isDemoMode()) return;
  const studentCount = await prisma.student.count();
  if (studentCount > 0) return;
  await upsertStudents(DEMO_STUDENTS);
  await upsertIssues(DEMO_ISSUES);
  await getConfig();
}

export async function resetDemoData(): Promise<void> {
  await prisma.recommendation.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.student.deleteMany();
  await upsertStudents(DEMO_STUDENTS);
  await upsertIssues(DEMO_ISSUES);
  await prisma.appConfig.upsert({
    where: { id: 1 },
    update: {
      gitlabProjectId: GITLAB_PROJECT_ID || null,
      minParticipationPct: DEFAULT_MIN_PARTICIPATION_PCT,
    },
    create: {
      id: 1,
      gitlabProjectId: GITLAB_PROJECT_ID || null,
      minParticipationPct: DEFAULT_MIN_PARTICIPATION_PCT,
    },
  });
}

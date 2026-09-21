import type { Issue, Student } from "@/lib/types";

const LABEL_MATCH_POINTS = 3;
const TEXT_MATCH_POINTS = 1;

function normalizeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  for (const skill of skills) {
    const normalized = skill.trim().toLowerCase();
    if (normalized) seen.add(normalized);
  }
  return [...seen];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `\b` misses skills ending in punctuation (`c++`, `c#`), so boundaries are spelled out. */
function mentionsWholeWord(text: string, skill: string): boolean {
  return new RegExp(`(^|[^a-z0-9_])${escapeRegExp(skill)}([^a-z0-9_]|$)`, "i").test(text);
}

export function scoreIssueForStudent(
  student: Student,
  issue: Issue,
): { score: number; matchedLabels: string[] } {
  const skills = normalizeSkills(student.skills);
  const matchedLabels = issue.labels.filter((label) => skills.includes(label.trim().toLowerCase()));
  const labelSkills = new Set(matchedLabels.map((label) => label.trim().toLowerCase()));

  const text = `${issue.title}\n${issue.description}`;
  const textMatches = skills.filter(
    (skill) => !labelSkills.has(skill) && mentionsWholeWord(text, skill),
  );

  return {
    score: matchedLabels.length * LABEL_MATCH_POINTS + textMatches.length * TEXT_MATCH_POINTS,
    matchedLabels,
  };
}

export function describeReason(matchedLabels: string[], minParticipationPct: number): string {
  if (matchedLabels.length > 0) return `Matches labels: ${matchedLabels.join(", ")}`;
  return `Needed to reach ${minParticipationPct}% participation`;
}

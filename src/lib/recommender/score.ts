import { categoryBySlug, skillTermsForCategory } from "@/lib/ai/taxonomy";
import { mentionsWholeWord } from "@/lib/text-match";
import type { Issue, Student } from "@/lib/types";

const LABEL_MATCH_POINTS = 3;
const CATEGORY_MATCH_POINTS = 2;
const TEXT_MATCH_POINTS = 1;

function normalizeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  for (const skill of skills) {
    const normalized = skill.trim().toLowerCase();
    if (normalized) seen.add(normalized);
  }
  return [...seen];
}

export type IssueScore = {
  score: number;
  matchedLabels: string[];
  /** Slugs of the AI-assigned categories the student's skills line up with. */
  matchedCategories: string[];
};

export function scoreIssueForStudent(student: Student, issue: Issue): IssueScore {
  const skills = normalizeSkills(student.skills);
  const matchedLabels = issue.labels.filter((label) => skills.includes(label.trim().toLowerCase()));
  const claimed = new Set(matchedLabels.map((label) => label.trim().toLowerCase()));

  const matchedCategories: string[] = [];
  for (const { slug } of issue.categories) {
    const category = categoryBySlug(slug);
    if (!category) continue;
    const terms = skillTermsForCategory(category);
    const hit = skills.find((skill) => !claimed.has(skill) && terms.includes(skill));
    if (!hit) continue;
    claimed.add(hit);
    matchedCategories.push(slug);
  }

  const text = `${issue.title}\n${issue.description}`;
  const textMatches = skills.filter(
    (skill) => !claimed.has(skill) && mentionsWholeWord(text, skill),
  );

  return {
    score:
      matchedLabels.length * LABEL_MATCH_POINTS +
      matchedCategories.length * CATEGORY_MATCH_POINTS +
      textMatches.length * TEXT_MATCH_POINTS,
    matchedLabels,
    matchedCategories,
  };
}

export function describeReason(
  matchedLabels: string[],
  minParticipationPct: number,
  matchedCategories: string[] = [],
): string {
  const parts: string[] = [];
  if (matchedLabels.length > 0) parts.push(`labels: ${matchedLabels.join(", ")}`);
  if (matchedCategories.length > 0) {
    const names = matchedCategories.map((slug) => categoryBySlug(slug)?.label ?? slug);
    parts.push(`${names.length === 1 ? "category" : "categories"}: ${names.join(", ")}`);
  }
  if (parts.length > 0) return `Matches ${parts.join(" · ")}`;
  return `Needed to reach ${minParticipationPct}% participation`;
}

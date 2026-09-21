import { CATEGORIES } from "@/lib/ai/taxonomy";
import type { ChipTone } from "@/components/Chip";
import type { Issue } from "@/lib/types";

/** Filter value standing for issues the categorizer could not place. */
export const UNCATEGORIZED = "uncategorized";

export type CategoryCount = {
  slug: string;
  label: string;
  tone: ChipTone;
  total: number;
  open: number;
  unassigned: number;
};

export function issueMatchesCategory(issue: Issue, slug: string): boolean {
  if (slug === UNCATEGORIZED) return issue.categories.length === 0;
  return issue.categories.some((category) => category.slug === slug);
}

/** Counts per category, keeping taxonomy order and dropping categories nobody uses. */
export function summarizeCategories(issues: Issue[]): CategoryCount[] {
  const buckets: CategoryCount[] = [
    ...CATEGORIES.map((category) => ({
      slug: category.slug as string,
      label: category.label as string,
      tone: category.tone as ChipTone,
      total: 0,
      open: 0,
      unassigned: 0,
    })),
    { slug: UNCATEGORIZED, label: "Uncategorized", tone: "slate" as ChipTone, total: 0, open: 0, unassigned: 0 },
  ];

  for (const bucket of buckets) {
    for (const issue of issues) {
      if (!issueMatchesCategory(issue, bucket.slug)) continue;
      bucket.total += 1;
      if (issue.state !== "opened") continue;
      bucket.open += 1;
      if (issue.assigneeGitlabUserIds.length === 0) bucket.unassigned += 1;
    }
  }

  return buckets.filter((bucket) => bucket.total > 0);
}

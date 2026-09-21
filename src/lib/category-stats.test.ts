import { describe, expect, it } from "vitest";
import { type Issue, type IssueCategory } from "@/lib/types";
import { issueMatchesCategory, summarizeCategories, UNCATEGORIZED } from "@/lib/category-stats";

function category(slug: IssueCategory["slug"]): IssueCategory {
  return { slug, confidence: 1, evidence: [`label: ${slug}`] };
}

function issue(overrides: Partial<Issue> & Pick<Issue, "iid">): Issue {
  return {
    title: `Issue ${overrides.iid}`,
    description: "",
    state: "opened",
    labels: [],
    assigneeGitlabUserIds: [],
    webUrl: `https://gitlab.example.com/issues/${overrides.iid}`,
    categories: [],
    ...overrides,
  };
}

describe("issueMatchesCategory", () => {
  it("matches assigned slugs and treats empty as uncategorized", () => {
    const frontend = issue({ iid: 1, categories: [category("frontend")] });
    expect(issueMatchesCategory(frontend, "frontend")).toBe(true);
    expect(issueMatchesCategory(frontend, "backend")).toBe(false);
    expect(issueMatchesCategory(frontend, UNCATEGORIZED)).toBe(false);
    expect(issueMatchesCategory(issue({ iid: 2 }), UNCATEGORIZED)).toBe(true);
  });
});

describe("summarizeCategories", () => {
  it("keeps taxonomy order, drops unused buckets, and counts open unassigned work", () => {
    const counts = summarizeCategories([
      issue({ iid: 1, categories: [category("testing")], state: "closed", assigneeGitlabUserIds: [1] }),
      issue({ iid: 2, categories: [category("frontend"), category("testing")] }),
      issue({ iid: 3 }),
    ]);
    expect(counts.map((count) => count.slug)).toEqual(["frontend", "testing", UNCATEGORIZED]);
    expect(counts.find((count) => count.slug === "testing")).toEqual({
      slug: "testing",
      label: "Testing",
      tone: "emerald",
      total: 2,
      open: 1,
      unassigned: 1,
    });
  });
});

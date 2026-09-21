import { describe, expect, it } from "vitest";
import { classifyTask, keywordCategorizer, type CategorizerInput } from "@/lib/ai/categorize";
import { CATEGORY_SLUGS, categoryBySlug, isCategorySlug } from "@/lib/ai/taxonomy";

function task(overrides: Partial<CategorizerInput> = {}): CategorizerInput {
  return { title: "", description: "", labels: [], ...overrides };
}

function slugs(input: CategorizerInput): string[] {
  return classifyTask(input).map((suggestion) => suggestion.slug);
}

describe("taxonomy", () => {
  it("has unique slugs and never aliases the same term to two categories", () => {
    expect(new Set(CATEGORY_SLUGS).size).toBe(CATEGORY_SLUGS.length);

    const owner = new Map<string, string>();
    for (const slug of CATEGORY_SLUGS) {
      const category = categoryBySlug(slug);
      expect(category).not.toBeNull();
      for (const alias of category!.labelAliases) {
        expect(owner.get(alias)).toBeUndefined();
        owner.set(alias, slug);
      }
    }
  });

  it("recognises its own slugs and rejects unknown ones", () => {
    expect(isCategorySlug("security")).toBe(true);
    expect(isCategorySlug("astrology")).toBe(false);
  });
});

describe("classifyTask", () => {
  it("assigns the category a GitLab label points at", () => {
    expect(slugs(task({ title: "Something vague", labels: ["security"] }))).toEqual(["security"]);
  });

  it("maps label aliases onto the canonical slug", () => {
    expect(slugs(task({ labels: ["a11y"] }))).toEqual(["accessibility"]);
    expect(slugs(task({ labels: ["front-end"] }))).toEqual(["frontend"]);
  });

  it("assigns multiple categories to work that spans them", () => {
    expect(slugs(task({ title: "Rate limit the public API", labels: ["backend"] }))).toEqual([
      "backend",
      "security",
    ]);
  });

  it("ranks a label above a title keyword, and drops a lone body mention", () => {
    const ranked = classifyTask(
      task({
        title: "Add unit test helpers",
        description: "Run them in the pipeline.",
        labels: ["frontend"],
      }),
    );
    expect(ranked.map((entry) => entry.slug)).toEqual(["frontend", "testing"]);
    expect(ranked[0].confidence).toBeGreaterThan(ranked[1].confidence);
  });

  it("classifies from the title alone when the issue carries no labels", () => {
    expect(slugs(task({ title: "Set up the Postgres schema" }))).toContain("database");
  });

  it("needs more than one stray body mention before it commits to a category", () => {
    expect(slugs(task({ title: "Tidy up", description: "Maybe touch the icon." }))).toEqual([]);
    expect(
      slugs(task({ title: "Tidy up", description: "Update the icon and the color palette." })),
    ).toEqual(["design"]);
  });

  it("returns nothing rather than guessing on unclassifiable text", () => {
    expect(classifyTask(task({ title: "Decide on a team name" }))).toEqual([]);
  });

  it("keeps at most three categories", () => {
    const many = classifyTask(
      task({
        title: "Rewrite everything",
        labels: ["frontend", "backend", "security", "testing", "docs"],
      }),
    );
    expect(many).toHaveLength(3);
  });

  it("reports the evidence behind every category", () => {
    const [security] = classifyTask(task({ title: "Rate limit the public API" })).filter(
      (entry) => entry.slug === "security",
    );
    expect(security.evidence).toContain("title: rate limit");
  });

  it("is deterministic and case-insensitive", () => {
    const upper = task({ title: "RATE LIMIT THE PUBLIC API", labels: ["Security"] });
    const lower = task({ title: "rate limit the public api", labels: ["security"] });
    expect(classifyTask(upper)).toEqual(classifyTask(lower));
    expect(classifyTask(upper)).toEqual(classifyTask(upper));
  });
});

describe("keywordCategorizer", () => {
  it("classifies a batch positionally", async () => {
    const results = await keywordCategorizer.categorize([
      task({ labels: ["docs"] }),
      task({ title: "Decide on a team name" }),
      task({ labels: ["testing"] }),
    ]);
    expect(results.map((entry) => entry.map((s) => s.slug))).toEqual([["docs"], [], ["testing"]]);
  });
});

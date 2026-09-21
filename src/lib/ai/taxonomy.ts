import type { ChipTone } from "@/components/Chip";

export type Category = {
  readonly slug: string;
  readonly label: string;
  readonly tone: ChipTone;
  /** GitLab labels that mean this category; also the skills a student can type to match it. */
  readonly labelAliases: readonly string[];
  /** Phrases looked for in the issue title and description. */
  readonly keywords: readonly string[];
};

export const CATEGORIES = [
  {
    slug: "frontend",
    label: "Frontend",
    tone: "sky",
    labelAliases: ["frontend", "front-end", "ui", "web"],
    keywords: [
      "component",
      "css",
      "tailwind",
      "react",
      "button",
      "form",
      "modal",
      "layout",
      "empty state",
      "dark mode",
      "landing page",
      "hero",
      "navbar",
      "nav bar",
    ],
  },
  {
    slug: "backend",
    label: "Backend",
    tone: "lavender",
    labelAliases: ["backend", "back-end", "api", "server"],
    keywords: [
      "endpoint",
      "api",
      "route",
      "handler",
      "service",
      "webhook",
      "background job",
      "queue",
      "cron",
      "server",
      "cache",
      "object storage",
    ],
  },
  {
    slug: "database",
    label: "Database",
    tone: "amber",
    labelAliases: ["database", "db", "data", "sql"],
    keywords: [
      "schema",
      "migration",
      "query",
      "index",
      "postgres",
      "sqlite",
      "prisma",
      "sql",
      "seed script",
      "table",
    ],
  },
  {
    slug: "security",
    label: "Security",
    tone: "peach",
    labelAliases: ["security", "auth", "authn", "authz"],
    keywords: [
      "rate limit",
      "csrf",
      "xss",
      "sql injection",
      "vulnerability",
      "encryption",
      "secret",
      "token",
      "password",
      "permission",
      "authentication",
      "authorization",
      "login",
      "oauth",
      "sanitize",
    ],
  },
  {
    slug: "testing",
    label: "Testing",
    tone: "emerald",
    labelAliases: ["testing", "test", "tests", "qa"],
    keywords: [
      "unit test",
      "integration test",
      "end-to-end",
      "e2e",
      "test coverage",
      "flaky",
      "regression",
      "fixture",
      "assertion",
      "vitest",
      "jest",
      "tests",
    ],
  },
  {
    slug: "devops",
    label: "DevOps",
    tone: "slate",
    labelAliases: ["devops", "ci", "cd", "infra", "infrastructure", "build"],
    keywords: [
      "pipeline",
      "ci job",
      "deploy",
      "deployment",
      "docker",
      "kubernetes",
      "release",
      "rollback",
      "monitoring",
      "logging",
      "environment variable",
    ],
  },
  {
    slug: "docs",
    label: "Docs",
    tone: "slate",
    labelAliases: ["docs", "doc", "documentation", "writing"],
    keywords: [
      "document",
      "readme",
      "changelog",
      "tutorial",
      "guide",
      "api reference",
      "docstring",
      "onboarding docs",
    ],
  },
  {
    slug: "design",
    label: "Design",
    tone: "sky",
    labelAliases: ["design", "ux", "visual"],
    keywords: [
      "mockup",
      "wireframe",
      "figma",
      "typography",
      "spacing",
      "color palette",
      "icon",
      "style guide",
      "branding",
    ],
  },
  {
    slug: "performance",
    label: "Performance",
    tone: "amber",
    labelAliases: ["performance", "perf", "optimization"],
    keywords: [
      "slow",
      "latency",
      "optimize",
      "speed up",
      "n+1",
      "memory leak",
      "bundle size",
      "throughput",
      "profiling",
      "cache",
    ],
  },
  {
    slug: "accessibility",
    label: "Accessibility",
    tone: "emerald",
    labelAliases: ["accessibility", "a11y"],
    keywords: [
      "screen reader",
      "keyboard navigation",
      "aria",
      "contrast",
      "focus order",
      "alt text",
      "wcag",
    ],
  },
] as const satisfies readonly Category[];

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const CATEGORY_SLUGS: CategorySlug[] = CATEGORIES.map((category) => category.slug);

const BY_SLUG = new Map<string, Category>(CATEGORIES.map((category) => [category.slug, category]));

export function categoryBySlug(slug: string): Category | null {
  return BY_SLUG.get(slug) ?? null;
}

export function isCategorySlug(value: string): value is CategorySlug {
  return BY_SLUG.has(value);
}

/** Every term that makes a student's skill count as a match for a category. */
export function skillTermsForCategory(category: Category): string[] {
  return [...new Set([category.slug, ...category.labelAliases])];
}

import { ACCESS_LEVEL, type Issue, type Student } from "@/lib/types";

export const DEMO_STUDENTS: Student[] = [
  {
    gitlabUserId: 101,
    username: "amelia",
    name: "Amelia Okonkwo",
    avatarUrl: null,
    accessLevel: ACCESS_LEVEL.DEVELOPER,
    skills: ["frontend", "design"],
  },
  {
    gitlabUserId: 102,
    username: "bruno",
    name: "Bruno Kovac",
    avatarUrl: null,
    accessLevel: ACCESS_LEVEL.DEVELOPER,
    skills: ["backend", "database"],
  },
  {
    gitlabUserId: 103,
    username: "chen",
    name: "Chen Wei",
    avatarUrl: null,
    accessLevel: ACCESS_LEVEL.DEVELOPER,
    skills: ["testing"],
  },
  {
    gitlabUserId: 104,
    username: "dara",
    name: "Dara Nilsson",
    avatarUrl: null,
    accessLevel: ACCESS_LEVEL.DEVELOPER,
    skills: [],
  },
  {
    gitlabUserId: 105,
    username: "eshan",
    name: "Eshan Patel",
    avatarUrl: null,
    accessLevel: ACCESS_LEVEL.DEVELOPER,
    skills: ["docs", "frontend"],
  },
  {
    gitlabUserId: 100,
    username: "prof-lindqvist",
    name: "Prof. Lindqvist",
    avatarUrl: null,
    accessLevel: ACCESS_LEVEL.MAINTAINER,
    skills: [],
  },
];

function demoIssue(
  iid: number,
  title: string,
  labels: string[],
  state: Issue["state"],
  assigneeGitlabUserIds: number[],
  description = "",
): Issue {
  return {
    iid,
    title,
    description,
    state,
    labels,
    assigneeGitlabUserIds,
    webUrl: `https://gitlab.com/demo/course-project/-/issues/${iid}`,
    categories: [],
  };
}

export const DEMO_ISSUES: Issue[] = [
  demoIssue(1, "Build the landing page hero", ["frontend", "design"], "closed", [101]),
  demoIssue(2, "Set up the Postgres schema", ["backend", "database"], "closed", [102]),
  demoIssue(3, "Add login form validation", ["frontend"], "opened", [101]),
  demoIssue(4, "Write integration tests for checkout", ["testing"], "opened", [103]),
  demoIssue(5, "Document the deployment steps", ["docs"], "opened", []),
  demoIssue(6, "Cache the product listing endpoint", ["backend", "performance"], "opened", []),
  demoIssue(7, "Dark mode for the dashboard", ["frontend", "design"], "opened", []),
  demoIssue(8, "Seed script for sample data", ["database", "backend"], "opened", []),
  demoIssue(9, "Accessibility audit of the nav bar", ["frontend", "accessibility"], "opened", []),
  demoIssue(10, "Unit tests for the pricing helper", ["testing"], "opened", []),
  demoIssue(11, "Write the API reference page", ["docs"], "opened", []),
  demoIssue(12, "Fix flaky CI job", ["testing", "ci"], "opened", []),
  demoIssue(13, "Rate limit the public API", ["backend", "security"], "opened", []),
  demoIssue(14, "Empty states for the issue list", ["frontend"], "opened", []),
  demoIssue(15, "Migrate uploads to object storage", ["backend", "database"], "opened", []),
  // Unlabelled on purpose: these only get categories because the text is read.
  demoIssue(
    16,
    "Users can paste script tags into their bio",
    [],
    "opened",
    [],
    "Sanitize the field before it is rendered; right now it is an xss hole.",
  ),
  demoIssue(
    17,
    "The class list query is slow",
    [],
    "opened",
    [],
    "Looks like an n+1: optimize it and add an index.",
  ),
];

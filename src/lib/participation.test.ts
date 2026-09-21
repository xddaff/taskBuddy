import { describe, expect, it } from "vitest";
import { ACCESS_LEVEL, type Issue, type Student } from "@/lib/types";
import { computeParticipation, isClassMember, targetCountFor } from "@/lib/participation";

function student(overrides: Partial<Student> & Pick<Student, "gitlabUserId" | "username">): Student {
  return {
    name: overrides.username,
    avatarUrl: null,
    accessLevel: ACCESS_LEVEL.DEVELOPER,
    skills: [],
    ...overrides,
  };
}

function issue(overrides: Partial<Issue> & Pick<Issue, "iid">): Issue {
  return {
    title: `Issue ${overrides.iid}`,
    description: "",
    state: "opened",
    labels: [],
    assigneeGitlabUserIds: [],
    webUrl: `https://gitlab.example.com/issues/${overrides.iid}`,
    ...overrides,
  };
}

describe("isClassMember", () => {
  it("includes developers and excludes guests, reporters, maintainers and owners", () => {
    expect(isClassMember(student({ gitlabUserId: 1, username: "dev" }))).toBe(true);
    expect(
      isClassMember(student({ gitlabUserId: 2, username: "guest", accessLevel: ACCESS_LEVEL.GUEST })),
    ).toBe(false);
    expect(
      isClassMember(
        student({ gitlabUserId: 3, username: "reporter", accessLevel: ACCESS_LEVEL.REPORTER }),
      ),
    ).toBe(false);
    expect(
      isClassMember(
        student({ gitlabUserId: 4, username: "maintainer", accessLevel: ACCESS_LEVEL.MAINTAINER }),
      ),
    ).toBe(false);
    expect(
      isClassMember(student({ gitlabUserId: 5, username: "owner", accessLevel: ACCESS_LEVEL.OWNER })),
    ).toBe(false);
  });
});

describe("targetCountFor", () => {
  it("rounds up to whole issues", () => {
    expect(targetCountFor(15, 20)).toBe(3);
    expect(targetCountFor(10, 25)).toBe(3);
    expect(targetCountFor(7, 50)).toBe(4);
  });

  it("clamps to the issue count", () => {
    expect(targetCountFor(0, 25)).toBe(0);
    expect(targetCountFor(4, 0)).toBe(0);
    expect(targetCountFor(4, 150)).toBe(4);
    expect(targetCountFor(4, -10)).toBe(0);
  });
});

describe("computeParticipation", () => {
  const students = [
    student({ gitlabUserId: 2, username: "bea" }),
    student({ gitlabUserId: 1, username: "ana" }),
    student({ gitlabUserId: 9, username: "prof", accessLevel: ACCESS_LEVEL.MAINTAINER }),
  ];
  const issues = [
    issue({ iid: 1, assigneeGitlabUserIds: [1] }),
    issue({ iid: 2, assigneeGitlabUserIds: [1, 9], state: "closed" }),
    issue({ iid: 3 }),
    issue({ iid: 4 }),
  ];

  it("counts assigned issues in both states and derives pct, target and need", () => {
    const stats = computeParticipation(students, issues, 50);
    expect(stats.map((s) => s.username)).toEqual(["ana", "bea"]);

    const [ana, bea] = stats;
    expect(ana).toMatchObject({
      currentCount: 2,
      totalIssues: 4,
      pct: 50,
      targetCount: 2,
      need: 0,
      meetsTarget: true,
    });
    expect(bea).toMatchObject({
      currentCount: 0,
      pct: 0,
      targetCount: 2,
      need: 2,
      meetsTarget: false,
    });
  });

  it("excludes maintainers from the stats", () => {
    const stats = computeParticipation(students, issues, 50);
    expect(stats.some((s) => s.username === "prof")).toBe(false);
  });

  it("rounds pct to one decimal place", () => {
    const threeIssues = [issue({ iid: 1, assigneeGitlabUserIds: [1] }), issue({ iid: 2 }), issue({ iid: 3 })];
    const [ana] = computeParticipation([student({ gitlabUserId: 1, username: "ana" })], threeIssues, 20);
    expect(ana.pct).toBe(33.3);
  });

  it("handles a project with no issues", () => {
    const [ana] = computeParticipation([student({ gitlabUserId: 1, username: "ana" })], [], 25);
    expect(ana).toMatchObject({ totalIssues: 0, pct: 0, targetCount: 0, need: 0, meetsTarget: true });
  });
});

import { describe, expect, it } from "vitest";
import { ACCESS_LEVEL, type Issue, type Student } from "@/lib/types";
import { recommend, recommendationsForStudent } from "@/lib/recommender";
import { describeReason, scoreIssueForStudent } from "@/lib/recommender/score";

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

describe("scoreIssueForStudent", () => {
  it("awards 3 per label match, case-insensitively, keeping the issue label order", () => {
    const result = scoreIssueForStudent(
      student({ gitlabUserId: 1, username: "ana", skills: ["backend", "docs"] }),
      issue({ iid: 1, labels: ["Docs", "Backend", "ui"] }),
    );
    expect(result.matchedLabels).toEqual(["Docs", "Backend"]);
    expect(result.score).toBe(6);
  });

  it("awards 1 per whole-word text match that is not already a label match", () => {
    const result = scoreIssueForStudent(
      student({ gitlabUserId: 1, username: "ana", skills: ["backend", "sql", "go"] }),
      issue({
        iid: 1,
        title: "Tune the SQL query",
        description: "Nothing about golang here.",
        labels: ["backend"],
      }),
    );
    expect(result.matchedLabels).toEqual(["backend"]);
    expect(result.score).toBe(4);
  });

  it("scores 0 when nothing matches or the student has no skills", () => {
    expect(
      scoreIssueForStudent(
        student({ gitlabUserId: 1, username: "ana", skills: ["rust"] }),
        issue({ iid: 1, title: "Write docs", labels: ["docs"] }),
      ),
    ).toEqual({ score: 0, matchedLabels: [] });
    expect(
      scoreIssueForStudent(
        student({ gitlabUserId: 2, username: "bea" }),
        issue({ iid: 1, labels: ["docs"] }),
      ).score,
    ).toBe(0);
  });
});

describe("describeReason", () => {
  it("lists matched labels, falling back to the quota explanation", () => {
    expect(describeReason(["a", "b"], 25)).toBe("Matches labels: a, b");
    expect(describeReason([], 25)).toBe("Needed to reach 25% participation");
  });
});

describe("recommend", () => {
  it("prefers issues whose labels match the student's skills", () => {
    const plan = recommend({
      students: [student({ gitlabUserId: 1, username: "ana", skills: ["backend"] })],
      issues: [issue({ iid: 1, labels: ["frontend"] }), issue({ iid: 2, labels: ["backend"] })],
      minParticipationPct: 50,
    });
    expect(plan.recommendations).toEqual([
      {
        gitlabUserId: 1,
        issueIid: 2,
        rank: 1,
        score: 3,
        reason: "Matches labels: backend",
      },
    ]);
  });

  it("never recommends closed or already-assigned issues", () => {
    const plan = recommend({
      students: [student({ gitlabUserId: 1, username: "ana" })],
      issues: [
        issue({ iid: 1, state: "closed" }),
        issue({ iid: 2, assigneeGitlabUserIds: [7] }),
        issue({ iid: 3, state: "closed", assigneeGitlabUserIds: [1] }),
        issue({ iid: 4 }),
      ],
      minParticipationPct: 100,
    });
    expect(plan.recommendations.map((r) => r.issueIid)).toEqual([4]);
    expect(plan.feasible).toBe(false);
  });

  it("still fills the quota for a student without skills", () => {
    const plan = recommend({
      students: [student({ gitlabUserId: 1, username: "ana" })],
      issues: [issue({ iid: 1 }), issue({ iid: 2 }), issue({ iid: 3 }), issue({ iid: 4 })],
      minParticipationPct: 50,
    });
    const recs = recommendationsForStudent(plan, 1);
    expect(recs).toHaveLength(2);
    expect(recs.map((r) => r.issueIid)).toEqual([1, 2]);
    expect(recs.map((r) => r.rank)).toEqual([1, 2]);
    expect(recs[0].reason).toBe("Needed to reach 50% participation");
    expect(plan.feasible).toBe(true);
  });

  it("brings every student to their target and reports the untouched current standing", () => {
    const students = [
      student({ gitlabUserId: 3, username: "cid", skills: ["docs"] }),
      student({ gitlabUserId: 1, username: "ana", skills: ["backend"] }),
      student({ gitlabUserId: 2, username: "bea" }),
      student({ gitlabUserId: 9, username: "prof", accessLevel: ACCESS_LEVEL.MAINTAINER }),
    ];
    const issues = [
      issue({ iid: 1, assigneeGitlabUserIds: [1] }),
      issue({ iid: 2, labels: ["backend"] }),
      issue({ iid: 3, labels: ["docs"] }),
      issue({ iid: 4 }),
      issue({ iid: 5 }),
      issue({ iid: 6 }),
      issue({ iid: 7 }),
      issue({ iid: 8 }),
    ];
    const plan = recommend({ students, issues, minParticipationPct: 25 });

    expect(plan.feasible).toBe(true);
    expect(plan.warning).toBeNull();
    expect(plan.totalIssues).toBe(8);
    expect(plan.stats.map((s) => s.username)).toEqual(["ana", "bea", "cid"]);
    expect(plan.stats.map((s) => s.need)).toEqual([1, 2, 2]);

    for (const stat of plan.stats) {
      expect(recommendationsForStudent(plan, stat.gitlabUserId)).toHaveLength(stat.need);
    }
    const cid = recommendationsForStudent(plan, 3)[0];
    expect(cid).toMatchObject({ issueIid: 3, score: 3, reason: "Matches labels: docs" });
    expect(plan.recommendations.some((r) => r.gitlabUserId === 9)).toBe(false);
  });

  it("recommends each issue to at most one student", () => {
    const plan = recommend({
      students: [
        student({ gitlabUserId: 1, username: "ana", skills: ["backend"] }),
        student({ gitlabUserId: 2, username: "bea", skills: ["backend"] }),
        student({ gitlabUserId: 3, username: "cid", skills: ["backend"] }),
      ],
      issues: [1, 2, 3, 4, 5, 6].map((iid) => issue({ iid, labels: ["backend"] })),
      minParticipationPct: 34,
    });
    const iids = plan.recommendations.map((r) => r.issueIid);
    expect(new Set(iids).size).toBe(iids.length);
    expect(iids).toHaveLength(6);
  });

  it("flags an infeasible plan and spreads the scarce issues evenly", () => {
    const plan = recommend({
      students: [
        student({ gitlabUserId: 1, username: "ana" }),
        student({ gitlabUserId: 2, username: "bea" }),
        student({ gitlabUserId: 3, username: "cid" }),
      ],
      issues: [issue({ iid: 1 }), issue({ iid: 2 }), issue({ iid: 3 }), issue({ iid: 4 })],
      minParticipationPct: 50,
    });

    expect(plan.feasible).toBe(false);
    expect(plan.warning).toBe(
      "2 more open, unassigned issues are needed for every student to reach 50% participation.",
    );
    expect(plan.recommendations).toHaveLength(4);
    const perStudent = [1, 2, 3].map((id) => recommendationsForStudent(plan, id).length);
    expect(perStudent).toEqual([2, 1, 1]);
    expect(plan.stats.every((s) => s.need === 2)).toBe(true);
  });

  it("is deterministic for identical input", () => {
    const input = {
      students: [
        student({ gitlabUserId: 2, username: "bea", skills: ["ui"] }),
        student({ gitlabUserId: 1, username: "ana", skills: ["ui"] }),
      ],
      issues: [1, 2, 3, 4].map((iid) => issue({ iid, labels: iid % 2 === 0 ? ["ui"] : [] })),
      minParticipationPct: 50,
    };
    expect(recommend(input)).toEqual(recommend(input));
  });
});

import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";
import { assignIssue } from "@/lib/gitlab/client";
import { resolveProjectId } from "@/lib/gitlab/sync";
import { assignIssueLocally, listIssues, upsertIssues } from "@/lib/repo";
import { getAccessToken, getCurrentStudent } from "@/lib/session";
import type { Issue } from "@/lib/types";

export const dynamic = "force-dynamic";

function readIssueIid(body: unknown): number | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>).issueIid;
  const iid = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return typeof iid === "number" && Number.isInteger(iid) && iid > 0 ? iid : null;
}

async function findIssue(iid: number): Promise<Issue | undefined> {
  const issues = await listIssues();
  return issues.find((issue) => issue.iid === iid);
}

export async function POST(request: NextRequest) {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const issueIid = readIssueIid(body);
  if (issueIid === null) {
    return NextResponse.json({ error: "issueIid must be a positive integer" }, { status: 400 });
  }

  try {
    const existing = await findIssue(issueIid);
    if (!existing) {
      return NextResponse.json({ error: `Unknown issue #${issueIid}` }, { status: 404 });
    }

    if (isDemoMode()) {
      await assignIssueLocally(issueIid, student.gitlabUserId);
      const issue = await findIssue(issueIid);
      return NextResponse.json({ ok: true, issue });
    }

    const token = await getAccessToken();
    if (!token) throw new Error("No GitLab access token in session");
    const projectId = await resolveProjectId();
    const assigneeIds = [
      ...new Set([...existing.assigneeGitlabUserIds, student.gitlabUserId]),
    ];
    const issue = await assignIssue(projectId, issueIid, assigneeIds, token);
    await upsertIssues([issue]);

    return NextResponse.json({ ok: true, issue });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { IssueCard } from "@/components/IssueCard";
import { NavBar } from "@/components/NavBar";
import { Pane } from "@/components/Pane";
import { ParticipationMeter } from "@/components/ParticipationMeter";
import { issuesByIid, loadClassPlan } from "@/lib/plan-service";
import { recommendationsForStudent } from "@/lib/recommender";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const student = await getCurrentStudent();
  if (!student) redirect("/");

  const { plan, issues, config } = await loadClassPlan();
  const byIid = issuesByIid(issues);

  const stat = plan.stats.find((entry) => entry.gitlabUserId === student.gitlabUserId) ?? null;
  const recommended = recommendationsForStudent(plan, student.gitlabUserId).flatMap(
    (recommendation) => {
      const issue = byIid.get(recommendation.issueIid);
      return issue ? [{ recommendation, issue }] : [];
    },
  );
  const assigned = issues.filter((issue) =>
    issue.assigneeGitlabUserIds.includes(student.gitlabUserId),
  );

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <NavBar student={student} active="dashboard" />

      <main className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(16rem,24%)_minmax(0,1fr)_minmax(16rem,26%)] lg:grid-rows-1">
        <div className="flex min-h-0 flex-col gap-3">
          {stat ? (
            <div className="rounded-pane bg-paper p-4 shadow-pane">
              <ParticipationMeter stat={stat} minParticipationPct={config.minParticipationPct} />
            </div>
          ) : (
            <Pane title="Your participation" className="shrink-0">
              <p className="text-sm leading-relaxed text-muted">
                Instructors are not part of the participation quota.
                {isMaintainer(student) ? (
                  <>
                    {" "}
                    <Link href="/class" className="font-medium text-ink underline underline-offset-4">
                      Open the class view
                    </Link>{" "}
                    to set the minimum and track everyone.
                  </>
                ) : null}
              </p>
            </Pane>
          )}

          <Pane
            title="Your skills"
            className="min-h-[12rem] flex-1"
            actions={
              <Link
                href="/profile"
                className="rounded-full px-2 py-1 text-sm font-medium text-muted hover:bg-black/[0.04] hover:text-ink"
              >
                Edit
              </Link>
            }
          >
            {student.skills.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {student.skills.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-full bg-lavender px-3 py-1 text-sm font-medium"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-relaxed text-muted">
                You have not listed any skills yet.{" "}
                <Link href="/profile" className="font-medium text-ink underline underline-offset-4">
                  Add them
                </Link>{" "}
                for better recommendations.
              </p>
            )}
          </Pane>
        </div>

        <Pane title="Recommended for you" className="min-h-[24rem] lg:min-h-0">
          <p className="mb-4 text-sm text-muted">
            {recommended.length} {recommended.length === 1 ? "issue" : "issues"}
          </p>
          {recommended.length > 0 ? (
            <ul className="space-y-3">
              {recommended.map(({ recommendation, issue }) => (
                <li key={issue.iid}>
                  <IssueCard
                    issue={issue}
                    reason={recommendation.reason}
                    rank={recommendation.rank}
                    claimable
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-[#f8f6fc] px-4 py-8 text-center text-sm text-muted">
              {plan.warning ??
                (stat?.meetsTarget
                  ? "Nothing left to recommend: you have already met the participation minimum."
                  : "There are no open issues left to recommend right now. Sync from GitLab to pull in new ones.")}
            </p>
          )}
        </Pane>

        <Pane title="Your issues" className="min-h-[18rem] lg:min-h-0">
          {assigned.length > 0 ? (
            <ul className="space-y-3">
              {assigned.map((issue) => (
                <li key={issue.iid}>
                  <IssueCard issue={issue} assigned compact />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-[#f8f6fc] px-4 py-8 text-center text-sm text-muted">
              You have not claimed any issues yet. Claim one of the recommendations to get started.
            </p>
          )}
        </Pane>
      </main>
    </div>
  );
}

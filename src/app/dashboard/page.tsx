import Link from "next/link";
import { redirect } from "next/navigation";
import { IssueCard } from "@/components/IssueCard";
import { NavBar } from "@/components/NavBar";
import { Pane } from "@/components/Pane";
import { ParticipationMeter } from "@/components/ParticipationMeter";
import { issuesByIid, loadClassPlan } from "@/lib/plan-service";
import { recommendationsForStudent } from "@/lib/recommender";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer, type ClassPlan, type ParticipationStat } from "@/lib/types";

export const dynamic = "force-dynamic";

function emptyRecommendationCopy(
  plan: ClassPlan,
  stat: ParticipationStat | null,
): string {
  if (!stat) {
    return "Instructors are not part of the recommendation pool. Open the class view to track students.";
  }
  if (stat.meetsTarget) {
    return `Nothing left to recommend: you already have ${stat.currentCount} of ${stat.totalIssues} issues, which meets the ${plan.minParticipationPct}% minimum.`;
  }
  if (plan.warning) {
    return `No issues were left for you after filling larger participation gaps. ${plan.warning}`;
  }
  return "There are no open, unassigned issues left to recommend right now. Sync from GitLab to pull in new ones.";
}

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

      <main className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(13rem,18%)_minmax(0,1fr)_minmax(16rem,24%)] lg:grid-rows-1">
        <div className="flex min-h-0 flex-col gap-3 lg:min-h-0">
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

          <section className="shrink-0 rounded-pane bg-paper px-4 py-3 shadow-pane">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-medium tracking-tight text-ink">Skills</h2>
              <Link
                href="/profile"
                className="rounded-full px-2 py-0.5 text-[11px] font-medium text-muted hover:bg-black/[0.04] hover:text-ink"
              >
                Edit
              </Link>
            </div>
            {student.skills.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1">
                {student.skills.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-full bg-lavender px-2 py-0.5 text-[11px] font-medium text-[#4a3c7a]"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                None yet.{" "}
                <Link href="/profile" className="font-medium text-ink underline underline-offset-2">
                  Add skills
                </Link>
              </p>
            )}
          </section>
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
              {emptyRecommendationCopy(plan, stat)}
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

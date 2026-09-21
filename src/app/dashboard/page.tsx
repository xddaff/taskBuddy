import Link from "next/link";
import { redirect } from "next/navigation";
import { CategoryFilter } from "@/components/CategoryFilter";
import { IssueCard } from "@/components/IssueCard";
import { NavBar } from "@/components/NavBar";
import { ParticipationMeter } from "@/components/ParticipationMeter";
import { issueMatchesCategory, summarizeCategories } from "@/lib/category-stats";
import { issuesByIid, loadClassPlan } from "@/lib/plan-service";
import { recommendationsForStudent } from "@/lib/recommender";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer } from "@/lib/types";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{ category?: string | string[] }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const student = await getCurrentStudent();
  if (!student) redirect("/");

  const { plan, issues, config } = await loadClassPlan();
  const byIid = issuesByIid(issues);

  const stat = plan.stats.find((entry) => entry.gitlabUserId === student.gitlabUserId) ?? null;
  const allRecommended = recommendationsForStudent(plan, student.gitlabUserId).flatMap(
    (recommendation) => {
      const issue = byIid.get(recommendation.issueIid);
      return issue ? [{ recommendation, issue }] : [];
    },
  );
  const allAssigned = issues.filter((issue) =>
    issue.assigneeGitlabUserIds.includes(student.gitlabUserId),
  );

  const counts = summarizeCategories([
    ...allRecommended.map((entry) => entry.issue),
    ...allAssigned,
  ]);
  const requested = searchParams ? (await searchParams).category : undefined;
  const raw = Array.isArray(requested) ? requested[0] : requested;
  const activeCategory = counts.some((count) => count.slug === raw) ? (raw as string) : null;

  const recommended = activeCategory
    ? allRecommended.filter((entry) => issueMatchesCategory(entry.issue, activeCategory))
    : allRecommended;
  const assigned = activeCategory
    ? allAssigned.filter((issue) => issueMatchesCategory(issue, activeCategory))
    : allAssigned;

  return (
    <>
      <NavBar student={student} active="dashboard" />

      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{student.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {student.skills.length > 0 ? (
              <>
                Matching your skills ({student.skills.join(", ")}) against the categories TaskBuddy
                assigned to each task.
              </>
            ) : (
              <>
                You have not listed any skills yet.{" "}
                <Link href="/profile" className="font-medium text-ink underline underline-offset-4">
                  Add them
                </Link>{" "}
                for better recommendations.
              </>
            )}
          </p>
        </div>

        {stat ? (
          <ParticipationMeter stat={stat} minParticipationPct={config.minParticipationPct} />
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-muted">Your participation</h2>
            <p className="mt-2 text-sm">
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
          </section>
        )}

        <CategoryFilter
          basePath="/dashboard"
          active={activeCategory}
          counts={counts}
          total={allRecommended.length + allAssigned.length}
        />

        <section aria-labelledby="recommended-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="recommended-heading" className="text-lg font-semibold">
              Recommended for you
            </h2>
            <p className="text-sm text-muted">
              {recommended.length} {recommended.length === 1 ? "issue" : "issues"}
            </p>
          </div>

          {recommended.length > 0 ? (
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
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
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-muted">
              {activeCategory
                ? "None of your recommendations fall in this category. Pick another one above."
                : plan.warning ??
                  (stat?.meetsTarget
                    ? "Nothing left to recommend: you have already met the participation minimum."
                    : "There are no open issues left to recommend right now. Sync from GitLab to pull in new ones.")}
            </p>
          )}
        </section>

        <section aria-labelledby="assigned-heading">
          <h2 id="assigned-heading" className="text-lg font-semibold">
            Your issues
          </h2>
          {assigned.length > 0 ? (
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {assigned.map((issue) => (
                <li key={issue.iid}>
                  <IssueCard issue={issue} assigned />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-muted">
              {activeCategory
                ? "You have no issues in this category yet."
                : "You have not claimed any issues yet. Claim one of the recommendations above to get started."}
            </p>
          )}
        </section>
      </main>
    </>
  );
}

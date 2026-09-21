import Link from "next/link";
import { redirect } from "next/navigation";
import { Chip } from "@/components/Chip";
import { MinParticipationForm } from "@/components/MinParticipationForm";
import { NavBar } from "@/components/NavBar";
import { RecategorizeButton } from "@/components/RecategorizeButton";
import { summarizeCategories } from "@/lib/category-stats";
import { loadClassPlan } from "@/lib/plan-service";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClassPage() {
  const student = await getCurrentStudent();
  if (!student) redirect("/");
  if (!isMaintainer(student)) redirect("/dashboard");

  const { plan, config, issues } = await loadClassPlan();
  const categoryCounts = summarizeCategories(issues);

  const recommendedCounts = new Map<number, number>();
  for (const recommendation of plan.recommendations) {
    recommendedCounts.set(
      recommendation.gitlabUserId,
      (recommendedCounts.get(recommendation.gitlabUserId) ?? 0) + 1,
    );
  }

  const shortOfTarget = plan.stats.filter((stat) => !stat.meetsTarget).length;

  return (
    <>
      <NavBar student={student} active="class" />

      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Class overview</h1>
            <p className="mt-1 text-sm text-muted">
              {plan.stats.length} students · {plan.totalIssues} issues · {shortOfTarget} below the
              minimum
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-ink underline underline-offset-4"
          >
            Back to dashboard
          </Link>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <MinParticipationForm initialPct={config.minParticipationPct} />
        </section>

        <section
          aria-labelledby="categories-heading"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="categories-heading" className="text-lg font-semibold">
                Work by category
              </h2>
              <p className="mt-1 text-sm text-muted">
                TaskBuddy categorizes every task from its title, description, and labels. Students
                never set these.
              </p>
            </div>
            <RecategorizeButton />
          </div>

          {categoryCounts.length > 0 ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryCounts.map((count) => (
                <li
                  key={count.slug}
                  className="rounded-lg border border-slate-200 px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Chip tone={count.tone}>{count.label}</Chip>
                    <span className="font-semibold tabular-nums">{count.total}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {count.open} open · {count.unassigned} still unclaimed
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-muted">
              No tasks to categorize yet. Sync from GitLab to pull in the project issues.
            </p>
          )}
        </section>

        {!plan.feasible ? (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            {plan.warning ??
              "There are not enough open issues for every student to reach this minimum."}
          </p>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <caption className="sr-only">
                Participation for every student in the course project
              </caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-6 py-3 font-medium">
                    Student
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">
                    Assigned
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">
                    Current %
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">
                    Target
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">
                    Gap
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-medium">
                    Recommended
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plan.stats.map((stat) => (
                  <tr key={stat.gitlabUserId} className="hover:bg-slate-50">
                    <th scope="row" className="px-6 py-4 font-normal">
                      <span className="block font-medium">{stat.name}</span>
                      <span className="block text-xs text-muted">@{stat.username}</span>
                    </th>
                    <td className="px-6 py-4 text-right tabular-nums">{stat.currentCount}</td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          stat.meetsTarget
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {stat.pct}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">{stat.targetCount}</td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      {stat.need === 0 ? "—" : stat.need}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      {recommendedCounts.get(stat.gitlabUserId) ?? 0}
                    </td>
                  </tr>
                ))}
                {plan.stats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted">
                      No class members yet. Sync from GitLab to pull in the project members.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

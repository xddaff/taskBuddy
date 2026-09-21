import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { FolderIcon } from "@/components/Icons";
import { MinParticipationForm } from "@/components/MinParticipationForm";
import { NavBar } from "@/components/NavBar";
import { loadClassPlan } from "@/lib/plan-service";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer } from "@/lib/types";

export const dynamic = "force-dynamic";

const COVER = ["bg-mist/90", "bg-peach/90", "bg-sky/80", "bg-lilac/90", "bg-sand", "bg-lavender"];

export default async function ClassPage() {
  const student = await getCurrentStudent();
  if (!student) redirect("/");
  if (!isMaintainer(student)) redirect("/dashboard");

  const { plan, config } = await loadClassPlan();

  const recommendedCounts = new Map<number, number>();
  for (const recommendation of plan.recommendations) {
    recommendedCounts.set(
      recommendation.gitlabUserId,
      (recommendedCounts.get(recommendation.gitlabUserId) ?? 0) + 1,
    );
  }

  const shortOfTarget = plan.stats.filter((stat) => !stat.meetsTarget).length;

  return (
    <div className="library-shell min-h-screen">
      <NavBar student={student} active="class" title="Class notebooks" />

      <main className="mx-auto w-full max-w-6xl space-y-10 px-5 pb-16 pt-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-muted">
              <BrandMark size="sm" />
              Featured notebooks
            </div>
            <h2 className="text-3xl font-medium tracking-tight">Class overview</h2>
            <p className="mt-2 text-sm text-muted">
              {plan.stats.length} students · {plan.totalIssues} issues · {shortOfTarget} below the
              minimum
            </p>
          </div>
        </div>

        <section className="rounded-pane bg-paper p-5 shadow-pane sm:p-6">
          <h3 className="text-sm font-medium">Studio settings</h3>
          <p className="mt-1 text-sm text-muted">
            Set the participation minimum every student notebook should reach.
          </p>
          <div className="mt-4">
            <MinParticipationForm initialPct={config.minParticipationPct} />
          </div>
        </section>

        {!plan.feasible ? (
          <p
            role="alert"
            className="rounded-pane border border-peach bg-peach/80 px-4 py-3 text-sm text-[#8c1d18]"
          >
            {plan.warning ??
              "There are not enough open issues for every student to reach this minimum."}
          </p>
        ) : null}

        <section>
          <h3 className="text-lg font-medium tracking-tight">Recent notebooks</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plan.stats.map((stat, index) => (
              <li
                key={stat.gitlabUserId}
                className={`rounded-[1.35rem] p-4 ${COVER[index % COVER.length]}`}
              >
                <FolderIcon />
                <p className="mt-6 truncate text-[15px] font-medium">{stat.name}</p>
                <p className="mt-1 text-xs text-muted">
                  @{stat.username} · {stat.currentCount} assigned · {stat.pct}%
                </p>
                <p className="mt-3 text-xs font-medium">
                  {stat.meetsTarget
                    ? "Target met"
                    : `${stat.need} more to reach ${stat.targetCount}`}
                </p>
              </li>
            ))}
            {plan.stats.length === 0 ? (
              <li className="rounded-[1.35rem] border border-dashed border-black/15 bg-white px-4 py-10 text-center text-sm text-muted">
                No class members yet. Sync from GitLab to pull in the project members.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="overflow-hidden rounded-pane bg-paper shadow-pane">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <caption className="sr-only">
                Participation for every student in the course project
              </caption>
              <thead className="border-b border-black/[0.06] bg-[#f8f6fc] text-xs text-muted">
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
              <tbody className="divide-y divide-black/[0.04]">
                {plan.stats.map((stat) => (
                  <tr key={stat.gitlabUserId} className="hover:bg-[#f8f6fc]">
                    <th scope="row" className="px-6 py-4 font-normal">
                      <span className="block font-medium">{stat.name}</span>
                      <span className="block text-xs text-muted">@{stat.username}</span>
                    </th>
                    <td className="px-6 py-4 text-right tabular-nums">{stat.currentCount}</td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          stat.meetsTarget ? "bg-mist text-[#0d652d]" : "bg-sand text-[#8a5a00]"
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
    </div>
  );
}

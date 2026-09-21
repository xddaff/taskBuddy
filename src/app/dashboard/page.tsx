import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckIcon, DocIcon, NoteIcon, PlusIcon, SendIcon } from "@/components/Icons";
import { IssueCard } from "@/components/IssueCard";
import { NavBar } from "@/components/NavBar";
import { Pane } from "@/components/Pane";
import { ParticipationMeter } from "@/components/ParticipationMeter";
import { issuesByIid, loadClassPlan } from "@/lib/plan-service";
import { recommendationsForStudent } from "@/lib/recommender";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer } from "@/lib/types";

export const dynamic = "force-dynamic";

const STUDIO_TILES: Array<{
  href: string;
  label: string;
  hint: string;
  className: string;
  maintainerOnly?: boolean;
}> = [
  { href: "/profile", label: "Skills", hint: "Sources", className: "bg-mist/80" },
  { href: "/dashboard", label: "Issues", hint: "Chat", className: "bg-peach/80" },
  { href: "/profile", label: "Add source", hint: "Discover", className: "bg-sky/70" },
  { href: "/class", label: "Class", hint: "Analytics", className: "bg-lilac/80", maintainerOnly: true },
];

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
  const studioTiles = STUDIO_TILES.filter((tile) => !tile.maintainerOnly || isMaintainer(student));

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <NavBar student={student} active="dashboard" title={student.name} />

      <main className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(15.5rem,22%)_minmax(0,1fr)_minmax(16.5rem,26%)] lg:grid-rows-1">
        <Pane
          title="Sources"
          className="min-h-[18rem] lg:min-h-0"
          actions={
            <Link
              href="/profile"
              className="inline-flex h-8 items-center rounded-full px-2 text-sm text-muted hover:bg-black/[0.04] hover:text-ink"
            >
              Discover
            </Link>
          }
        >
          <Link
            href="/profile"
            className="flex items-center justify-center gap-1.5 rounded-full border border-dashed border-black/15 px-3 py-2 text-sm font-medium text-ink transition hover:bg-[#f8f6fc]"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add sources
          </Link>

          {student.skills.length > 0 ? (
            <ul className="mt-4 space-y-0.5">
              <li className="flex items-center justify-between px-1 pb-2 text-xs text-muted">
                <span>Select all sources</span>
                <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-ink text-white">
                  <CheckIcon className="h-3 w-3" />
                </span>
              </li>
              {student.skills.map((skill) => (
                <li key={skill}>
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 rounded-xl px-1.5 py-2 transition hover:bg-black/[0.04]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky/80 text-accent">
                      <DocIcon />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{skill}</span>
                    <span className="flex h-4 w-4 items-center justify-center rounded-[4px] border border-ink/40 bg-white text-ink">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 px-2 text-center text-sm leading-relaxed text-muted">
              Saved skills appear here as sources.{" "}
              <Link href="/profile" className="font-medium text-ink underline underline-offset-4">
                Add them
              </Link>{" "}
              so recommendations can be grounded in what you already know.
            </p>
          )}
        </Pane>

        <Pane
          title="Chat"
          className="min-h-[28rem] lg:min-h-0"
          footer={
            <div className="space-y-2">
              {recommended.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {recommended.slice(0, 3).map(({ issue }) => (
                    <a
                      key={issue.iid}
                      href={`#issue-${issue.iid}`}
                      className="shrink-0 rounded-full bg-[#f1f3f4] px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-[#e8eaed]"
                    >
                      {issue.title}
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-2 rounded-[1.35rem] bg-[#f1f3f4] px-4 py-2.5">
                <p className="min-w-0 flex-1 truncate text-sm text-muted">
                  {recommended.length > 0
                    ? "Claim a recommendation to add it to your notebook"
                    : "Nothing left to claim right now"}
                </p>
                <span className="hidden text-xs text-muted sm:inline">
                  {recommended.length} {recommended.length === 1 ? "source" : "sources"}
                </span>
                {recommended[0] ? (
                  <a
                    href={`#issue-${recommended[0].issue.iid}`}
                    aria-label={`Jump to ${recommended[0].issue.title}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white hover:bg-black"
                  >
                    <SendIcon className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/40 text-white">
                    <SendIcon className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </div>
          }
        >
          <div className="mx-auto max-w-2xl px-1 pt-4">
            <p className="text-[13px] text-muted">
              {student.skills.length > 0
                ? `${student.skills.length} ${student.skills.length === 1 ? "source" : "sources"} grounded in your skills`
                : "0 sources · recommendations still fill your participation gap"}
            </p>
            <h3 className="mt-3 text-[1.65rem] font-medium leading-tight tracking-tight">
              Recommended for you
            </h3>
            {stat ? (
              <p className="mt-3 text-sm leading-relaxed text-ink/80">
                These open issues are the next best matches for closing your participation gap
                {student.skills.length > 0 ? ", using the skills you listed as sources." : "."}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-ink/80">
                Instructors are not part of the participation quota.
                {isMaintainer(student) ? (
                  <>
                    {" "}
                    <Link href="/class" className="font-medium text-accent hover:underline">
                      Open class analytics
                    </Link>{" "}
                    to set the minimum and track everyone.
                  </>
                ) : null}
              </p>
            )}

            {recommended.length > 0 ? (
              <ul className="mt-2">
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
              <p className="mt-8 rounded-2xl bg-[#f8f6fc] px-4 py-8 text-center text-sm text-muted">
                {plan.warning ??
                  (stat?.meetsTarget
                    ? "Nothing left to recommend: you have already met the participation minimum."
                    : "There are no open issues left to recommend right now. Sync from GitLab to pull in new ones.")}
              </p>
            )}
          </div>
        </Pane>

        <Pane title="Studio" className="min-h-[22rem] lg:min-h-0">
          {stat ? (
            <ParticipationMeter stat={stat} minParticipationPct={config.minParticipationPct} />
          ) : (
            <section className="rounded-2xl bg-[#f8f6fc] p-4 text-sm leading-relaxed text-muted">
              Instructors do not have a participation meter. Use analytics to watch the class
              instead.
            </section>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            {studioTiles.map((tile) => (
              <Link
                key={tile.label}
                href={tile.href}
                className={`flex min-h-[4.5rem] flex-col justify-center rounded-2xl px-3 py-3 text-left transition hover:brightness-95 ${tile.className}`}
              >
                <span className="text-sm font-medium">{tile.label}</span>
                <span className="text-[11px] text-ink/60">{tile.hint}</span>
              </Link>
            ))}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-medium">Notes</h3>
              <span className="text-xs text-muted">Your issues</span>
            </div>
            {assigned.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {assigned.map((issue) => (
                  <li key={issue.iid}>
                    <IssueCard issue={issue} assigned variant="note" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6 px-2 text-center text-sm text-muted">
                <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sand">
                  <NoteIcon className="h-5 w-5" />
                </span>
                Saved issues will appear here. Claim a recommendation in chat to add a note.
              </div>
            )}
          </div>
        </Pane>
      </main>
    </div>
  );
}

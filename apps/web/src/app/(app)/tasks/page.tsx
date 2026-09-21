import { prisma } from '@studentproj/db';
import Link from 'next/link';
import { TaskCard, type TaskCardData } from '@/components/TaskCard';
import { requireOnboardedUser } from '@/lib/data';
import { rescoreFeed } from './actions';

export default async function TasksPage() {
  const { user, profile } = await requireOnboardedUser();

  const [recommendations, indexedIssueCount] = await Promise.all([
    prisma.recommendation.findMany({
      where: { userId: user.id, status: 'SUGGESTED' },
      orderBy: { score: 'desc' },
      take: 25,
      include: {
        issue: {
          include: { project: { select: { name: true, pathWithNamespace: true } } },
        },
      },
    }),
    prisma.gitlabIssue.count({ where: { state: 'opened' } }),
  ]);

  const cards: TaskCardData[] = recommendations.map((recommendation) => ({
    recommendationId: recommendation.id,
    status: recommendation.status,
    score: recommendation.score,
    reasons: recommendation.reasons,
    breakdown: recommendation.breakdown as Record<string, number | null>,
    issue: {
      title: recommendation.issue.title,
      webUrl: recommendation.issue.webUrl,
      labels: recommendation.issue.labels,
      estimatedHours: recommendation.issue.estimatedHours,
      projectName: recommendation.issue.project.name,
      projectPath: recommendation.issue.project.pathWithNamespace,
      updatedAt: recommendation.issue.gitlabUpdatedAt.toISOString(),
    },
  }));

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Tasks for you</h1>
            <p className="mt-1 text-sm text-(--color-ink-muted)">
              Ranked against your stack and your {profile.weeklyHours} hours a week. Every card
              says why it is here.
            </p>
          </div>

          <form
            action={async () => {
              'use server';
              await rescoreFeed();
            }}
          >
            <button
              type="submit"
              className="shrink-0 rounded-md border border-(--color-border-subtle) px-3 py-1.5 text-xs text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
            >
              Rescore
            </button>
          </form>
        </header>

        {cards.length === 0 ? (
          <EmptyState indexedIssueCount={indexedIssueCount} />
        ) : (
          <div className="space-y-3">
            {cards.map((card) => (
              <TaskCard key={card.recommendationId} data={card} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/// The empty state has to distinguish two very different situations: nothing is
/// indexed yet, versus everything indexed has been dealt with. Telling a
/// student "no matches" when the index is simply empty sends them to fix the
/// wrong thing.
function EmptyState({ indexedIssueCount }: { indexedIssueCount: number }) {
  if (indexedIssueCount === 0) {
    return (
      <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-6">
        <h2 className="font-medium">Nothing is indexed yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-(--color-ink-muted)">
          No GitLab issues have been crawled, so there is nothing to rank. Set{' '}
          <code className="text-(--color-ink)">GITLAB_INDEX_TOKEN</code> and{' '}
          <code className="text-(--color-ink)">GITLAB_INDEX_GROUPS</code> in{' '}
          <code className="text-(--color-ink)">.env</code> and run{' '}
          <code className="text-(--color-ink)">pnpm gitlab:index</code>, or load the demo data with{' '}
          <code className="text-(--color-ink)">pnpm db:seed</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-6">
      <h2 className="font-medium">You are all caught up</h2>
      <p className="mt-2 text-sm leading-relaxed text-(--color-ink-muted)">
        You have been through everything we found across {indexedIssueCount} open issues. Check{' '}
        <Link href="/tasks/saved" className="text-(--color-accent) hover:underline">
          saved and claimed
        </Link>
        , or widen your profile in{' '}
        <Link href="/onboarding" className="text-(--color-accent) hover:underline">
          your profile
        </Link>
        .
      </p>
    </div>
  );
}

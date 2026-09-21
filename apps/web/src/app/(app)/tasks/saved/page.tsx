import { prisma, type RecommendationStatus } from '@studentproj/db';
import Link from 'next/link';
import { TaskCard, type TaskCardData } from '@/components/TaskCard';
import { requireOnboardedUser } from '@/lib/data';

const GROUPS: Array<{ status: RecommendationStatus; heading: string; blurb: string }> = [
  {
    status: 'CLAIMED',
    heading: 'Working on',
    blurb: 'Tracked here and linked to GitLab. Assign yourself there too so others know.',
  },
  { status: 'SAVED', heading: 'Saved for later', blurb: 'Things you wanted to come back to.' },
  {
    status: 'DISMISSED',
    heading: 'Not for you',
    blurb: 'These also nudge similar tasks down your feed.',
  },
];

export default async function SavedTasksPage() {
  const { user } = await requireOnboardedUser();

  const recommendations = await prisma.recommendation.findMany({
    where: { userId: user.id, status: { in: ['SAVED', 'CLAIMED', 'DISMISSED'] } },
    orderBy: [{ decidedAt: 'desc' }],
    include: { issue: { include: { project: { select: { name: true, pathWithNamespace: true } } } } },
  });

  const toCard = (recommendation: (typeof recommendations)[number]): TaskCardData => ({
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
  });

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1 className="text-xl font-semibold tracking-tight">Saved and claimed</h1>

        {recommendations.length === 0 ? (
          <p className="mt-6 text-sm text-(--color-ink-muted)">
            Nothing here yet. Save or claim something from{' '}
            <Link href="/tasks" className="text-(--color-accent) hover:underline">
              your feed
            </Link>
            .
          </p>
        ) : (
          <div className="mt-6 space-y-10">
            {GROUPS.map((group) => {
              const items = recommendations.filter(
                (recommendation) => recommendation.status === group.status,
              );
              if (items.length === 0) return null;

              return (
                <section key={group.status} className="space-y-3">
                  <div>
                    <h2 className="text-sm font-medium uppercase tracking-wider text-(--color-ink-faint)">
                      {group.heading}
                      <span className="ml-2 normal-case tracking-normal">({items.length})</span>
                    </h2>
                    <p className="mt-1 text-xs text-(--color-ink-faint)">{group.blurb}</p>
                  </div>
                  {items.map((recommendation) => (
                    <TaskCard key={recommendation.id} data={toCard(recommendation)} showUndo />
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

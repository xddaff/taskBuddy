import { prisma } from '@studentproj/db';
import { rankIssuesForProfile, type IssueInput, type ProfileInput } from '@studentproj/scoring';

/// Cap on how many indexed issues are scored per student. Scoring is cheap and
/// in-memory, but loading an unbounded index would not stay that way.
const CANDIDATE_LIMIT = 2000;

/// How many suggestions to keep per student. The feed is meant to be a
/// shortlist a student will actually read, not a search index.
const KEEP_PER_USER = 40;

export interface RefreshResult {
  userId: string;
  scored: number;
  created: number;
  updated: number;
  removed: number;
}

export async function refreshRecommendationsForUser(userId: string): Promise<RefreshResult> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: {
      skills: { include: { tag: true } },
      interests: { include: { tag: true } },
      signals: { include: { tag: true } },
    },
  });

  // An un-onboarded student has nothing to match against; scoring them would
  // produce a feed ranked purely by freshness, which is worse than an empty
  // state telling them to finish onboarding.
  if (!profile || !profile.onboardedAt) {
    return { userId, scored: 0, created: 0, updated: 0, removed: 0 };
  }

  const profileInput: ProfileInput = {
    skills: profile.skills.map((skill) => ({
      slug: skill.tag.slug,
      proficiency: skill.proficiency,
    })),
    interests: profile.interests.map((interest) => interest.tag.slug),
    weeklyHours: profile.weeklyHours,
    commitment: profile.commitment,
    experience: profile.experience,
    signals: profile.signals.map((signal) => ({ slug: signal.tag.slug, weight: signal.weight })),
  };

  const candidates = await prisma.gitlabIssue.findMany({
    where: { state: 'opened' },
    orderBy: { gitlabUpdatedAt: 'desc' },
    take: CANDIDATE_LIMIT,
    include: {
      tags: { include: { tag: { select: { slug: true } } } },
      project: { select: { healthScore: true } },
    },
  });

  const scoreInputs: Array<{ id: string } & IssueInput> = candidates.map((issue) => ({
    id: issue.id,
    tags: issue.tags.map((tag) => ({ slug: tag.tag.slug, weight: tag.weight })),
    labels: issue.labels,
    timeEstimateSeconds: issue.timeEstimateSeconds,
    weight: issue.weight,
    assigneeCount: issue.assigneeCount,
    updatedAt: issue.gitlabUpdatedAt,
    projectHealth: issue.project.healthScore,
  }));

  const ranked = rankIssuesForProfile(profileInput, scoreInputs, { limit: KEEP_PER_USER });

  const existing = await prisma.recommendation.findMany({
    where: { userId },
    select: { id: true, issueId: true, status: true },
  });
  const existingByIssue = new Map(existing.map((row) => [row.issueId, row]));

  let created = 0;
  let updated = 0;

  for (const entry of ranked) {
    const prior = existingByIssue.get(entry.issue.id);
    if (prior) {
      // Refresh the score and explanation but never the status: the student
      // already saved, claimed or dismissed this, and a reindex must not undo
      // that decision.
      await prisma.recommendation.update({
        where: { id: prior.id },
        data: {
          score: entry.score,
          breakdown: entry.breakdown,
          reasons: entry.reasons,
          generatedAt: new Date(),
        },
      });
      updated += 1;
    } else {
      await prisma.recommendation.create({
        data: {
          userId,
          issueId: entry.issue.id,
          score: entry.score,
          breakdown: entry.breakdown,
          reasons: entry.reasons,
        },
      });
      created += 1;
    }
  }

  // Drop suggestions that fell out of the shortlist. Only untouched ones:
  // anything the student acted on stays in their list.
  const keptIssueIds = new Set(ranked.map((entry) => entry.issue.id));
  const { count: removed } = await prisma.recommendation.deleteMany({
    where: {
      userId,
      status: 'SUGGESTED',
      issueId: { notIn: [...keptIssueIds] },
    },
  });

  return { userId, scored: ranked.length, created, updated, removed };
}

export async function refreshAllRecommendations(
  onProgress?: (message: string) => void,
): Promise<RefreshResult[]> {
  const log = onProgress ?? (() => {});
  const profiles = await prisma.studentProfile.findMany({
    where: { onboardedAt: { not: null } },
    select: { userId: true },
  });

  const results: RefreshResult[] = [];
  for (const { userId } of profiles) {
    const result = await refreshRecommendationsForUser(userId);
    results.push(result);
    log(
      `  ${userId}: ${result.scored} scored (${result.created} new, ${result.updated} refreshed, ${result.removed} dropped).`,
    );
  }
  return results;
}

/// Records implicit feedback when a student acts on a recommendation.
///
/// Dismissals push the issue's tags negative so the same kind of task stops
/// dominating the feed; claiming pushes them positive. Weighted by how
/// strongly the tag characterised the issue, so a passing mention moves the
/// needle less than a label.
export async function applyFeedback(input: {
  userId: string;
  issueId: string;
  direction: 'dismissed' | 'claimed';
}): Promise<void> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });
  if (!profile) return;

  const tags = await prisma.issueTag.findMany({
    where: { issueId: input.issueId },
    select: { tagId: true, weight: true },
  });

  const delta = input.direction === 'dismissed' ? -0.25 : 0.25;

  for (const tag of tags) {
    const step = delta * tag.weight;
    const current = await prisma.tagSignal.findUnique({
      where: { profileId_tagId: { profileId: profile.id, tagId: tag.tagId } },
      select: { weight: true },
    });

    // Clamped so a student who dismisses ten CSS tasks in a row does not
    // permanently exclude CSS from everything they are ever shown.
    const next = clamp(-1, 1, (current?.weight ?? 0) + step);

    await prisma.tagSignal.upsert({
      where: { profileId_tagId: { profileId: profile.id, tagId: tag.tagId } },
      create: { profileId: profile.id, tagId: tag.tagId, weight: next },
      update: { weight: next },
    });
  }
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

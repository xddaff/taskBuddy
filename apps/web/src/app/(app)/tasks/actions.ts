'use server';

import { prisma, type RecommendationStatus } from '@studentproj/db';
import { applyFeedback, refreshRecommendationsForUser } from '@studentproj/indexer';
import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth';

const DECIDABLE: RecommendationStatus[] = ['SUGGESTED', 'SAVED', 'CLAIMED', 'DISMISSED'];

export async function setRecommendationStatus(
  recommendationId: string,
  status: RecommendationStatus,
): Promise<void> {
  const userId = await requireUserId();
  if (!DECIDABLE.includes(status)) throw new Error(`Unknown status ${status}`);

  // Scoped by userId as well as id, so a guessed recommendation id cannot be
  // used to act on someone else's feed.
  const recommendation = await prisma.recommendation.findFirst({
    where: { id: recommendationId, userId },
    select: { id: true, issueId: true, status: true },
  });
  if (!recommendation) return;

  await prisma.recommendation.update({
    where: { id: recommendation.id },
    data: { status, decidedAt: status === 'SUGGESTED' ? null : new Date() },
  });

  // Only a first-time decision teaches us anything. Re-dismissing something
  // already dismissed, or undoing a decision, should not compound the signal.
  if (recommendation.status === 'SUGGESTED' && (status === 'DISMISSED' || status === 'CLAIMED')) {
    await applyFeedback({
      userId,
      issueId: recommendation.issueId,
      direction: status === 'DISMISSED' ? 'dismissed' : 'claimed',
    });
  }

  revalidatePath('/tasks');
  revalidatePath('/tasks/saved');
}

export async function rescoreFeed(): Promise<void> {
  const userId = await requireUserId();
  await refreshRecommendationsForUser(userId);
  revalidatePath('/tasks');
}

'use server';

import { prisma, type Commitment, type Experience } from '@studentproj/db';
import { refreshRecommendationsForUser } from '@studentproj/indexer';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth';

const COMMITMENTS = new Set<Commitment>(['CASUAL', 'MODERATE', 'SERIOUS']);
const EXPERIENCES = new Set<Experience>(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);

export interface OnboardingState {
  error?: string;
}

export async function saveOnboarding(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const userId = await requireUserId();

  const weeklyHours = Number.parseInt(String(formData.get('weeklyHours') ?? '5'), 10);
  const commitment = String(formData.get('commitment') ?? 'MODERATE') as Commitment;
  const experience = String(formData.get('experience') ?? 'BEGINNER') as Experience;
  const bio = String(formData.get('bio') ?? '').slice(0, 500);

  // Skills arrive as skill:<tagId> = proficiency, so one field carries both
  // which tag was picked and how strong the student says they are.
  const skills: Array<{ tagId: string; proficiency: number }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('skill:')) continue;
    const proficiency = Number.parseInt(String(value), 10);
    if (!Number.isFinite(proficiency) || proficiency < 1 || proficiency > 5) continue;
    skills.push({ tagId: key.slice('skill:'.length), proficiency });
  }

  const interestIds = formData
    .getAll('interests')
    .map((value) => String(value))
    .filter(Boolean);

  if (!Number.isFinite(weeklyHours) || weeklyHours < 1 || weeklyHours > 40) {
    return { error: 'Pick somewhere between 1 and 40 hours a week.' };
  }
  if (!COMMITMENTS.has(commitment) || !EXPERIENCES.has(experience)) {
    return { error: 'That commitment or experience level is not one of the options.' };
  }
  // Without at least one skill the feed can only rank by freshness, which is
  // not a recommendation. Better to ask now than to show an arbitrary list.
  if (skills.length === 0) {
    return { error: 'Pick at least one thing you can work with, so we have something to match.' };
  }

  // Reject tag ids that are not in the taxonomy rather than letting a crafted
  // form insert rows that point nowhere useful.
  const validTagIds = new Set(
    (
      await prisma.tag.findMany({
        where: { id: { in: [...skills.map((skill) => skill.tagId), ...interestIds] } },
        select: { id: true },
      })
    ).map((tag) => tag.id),
  );

  const validSkills = skills.filter((skill) => validTagIds.has(skill.tagId));
  const validInterests = interestIds.filter((id) => validTagIds.has(id));

  if (validSkills.length === 0) {
    return { error: 'Those skills were not recognised. Try picking them again.' };
  }

  const profile = await prisma.studentProfile.upsert({
    where: { userId },
    create: { userId, weeklyHours, commitment, experience, bio, onboardedAt: new Date() },
    update: { weeklyHours, commitment, experience, bio, onboardedAt: new Date() },
  });

  await prisma.$transaction([
    prisma.profileSkill.deleteMany({ where: { profileId: profile.id } }),
    prisma.profileSkill.createMany({
      data: validSkills.map((skill) => ({ profileId: profile.id, ...skill })),
      skipDuplicates: true,
    }),
    prisma.profileInterest.deleteMany({ where: { profileId: profile.id } }),
    prisma.profileInterest.createMany({
      data: validInterests.map((tagId) => ({ profileId: profile.id, tagId })),
      skipDuplicates: true,
    }),
  ]);

  // Score immediately rather than waiting for the worker's next tick: a
  // student who just finished onboarding expects a populated feed.
  await refreshRecommendationsForUser(userId);

  redirect('/tasks');
}

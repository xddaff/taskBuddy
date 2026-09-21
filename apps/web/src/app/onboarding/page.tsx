import { prisma } from '@studentproj/db';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getTaxonomyByKind } from '@/lib/data';
import { OnboardingForm } from './OnboardingForm';

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user?.id) redirect('/signin');

  const [taxonomy, profile] = await Promise.all([
    getTaxonomyByKind(),
    prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: { skills: true, interests: true },
    }),
  ]);

  const initial = {
    weeklyHours: profile?.weeklyHours ?? 6,
    commitment: profile?.commitment ?? 'MODERATE',
    experience: profile?.experience ?? 'BEGINNER',
    bio: profile?.bio ?? '',
    skills: Object.fromEntries(
      (profile?.skills ?? []).map((skill) => [skill.tagId, skill.proficiency]),
    ),
    interests: (profile?.interests ?? []).map((interest) => interest.tagId),
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <header className="mb-10 space-y-2">
        <p className="text-xs uppercase tracking-wider text-(--color-ink-faint)">
          {profile?.onboardedAt ? 'Your profile' : 'Getting started'}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile?.onboardedAt ? 'Edit your profile' : `Welcome, ${user.name ?? 'student'}`}
        </h1>
        <p className="text-sm leading-relaxed text-(--color-ink-muted)">
          Four questions. Everything you pick here is used to rank tasks, and every suggestion
          will tell you which of your answers put it there.
        </p>
      </header>

      <OnboardingForm
        skillGroups={[
          { heading: 'Languages', tags: taxonomy.languages },
          { heading: 'Frameworks', tags: taxonomy.frameworks },
          { heading: 'Tools and infrastructure', tags: taxonomy.tools },
        ]}
        interestOptions={[...taxonomy.topics, ...taxonomy.domains]}
        initial={initial}
      />
    </main>
  );
}

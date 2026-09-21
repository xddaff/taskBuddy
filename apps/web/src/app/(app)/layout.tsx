import type { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { requireOnboardedUser } from '@/lib/data';

/// Shell for every signed-in page.
///
/// Authentication and the onboarding redirect both happen here, so individual
/// pages can assume a session and a completed profile.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireOnboardedUser();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userId={user.id} userName={user.name ?? null} userImage={user.image} />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

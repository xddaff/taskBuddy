'use server';

import { prisma } from '@studentproj/db';
import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth';

export async function markAllMentionsRead(): Promise<void> {
  const userId = await requireUserId();

  await prisma.mention.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath('/mentions');
  // The sidebar carries the unread count.
  revalidatePath('/', 'layout');
}

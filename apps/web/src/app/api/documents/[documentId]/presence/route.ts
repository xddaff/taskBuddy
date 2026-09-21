import { prisma } from '@studentproj/db';
import { NextResponse } from 'next/server';
import type { PresencePayload } from '@/components/document/types';
import { currentUser } from '@/lib/auth';

/// Who currently holds a lock on which section of a document.
///
/// A polled endpoint rather than a socket: presence here is coarse (a handful
/// of sections, refreshed every few seconds) and locks already carry their own
/// expiry, so a missed poll self-corrects on the next one.
export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<NextResponse> {
  const user = await currentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { documentId } = await context.params;

  const document = await prisma.document.findFirst({
    where: { id: documentId, workspace: { members: { some: { userId: user.id } } } },
    select: { id: true },
  });
  if (!document) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const now = new Date();
  const locks = await prisma.documentSectionLock.findMany({
    // Expired rows are filtered rather than deleted: they are harmless, and
    // acquiring the section overwrites them in place.
    where: { documentId, expiresAt: { gt: now } },
    orderBy: { acquiredAt: 'asc' },
    select: {
      sectionId: true,
      userId: true,
      acquiredAt: true,
      expiresAt: true,
      user: { select: { name: true, image: true } },
    },
  });

  const payload: PresencePayload = {
    documentId,
    now: now.toISOString(),
    locks: locks.map((lock) => ({
      sectionId: lock.sectionId,
      userId: lock.userId,
      name: lock.user.name,
      image: lock.user.image,
      acquiredAt: lock.acquiredAt.toISOString(),
      expiresAt: lock.expiresAt.toISOString(),
    })),
  };

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}

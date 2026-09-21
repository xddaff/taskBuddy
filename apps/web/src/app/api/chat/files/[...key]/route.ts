import { prisma } from '@studentproj/db';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { attachmentStorage, StorageError } from '@/lib/storage';
import { isImageMimeType } from '@/lib/uploads';

/// Serves a chat attachment, authorised per request.
///
/// Attachments cannot be served from the public directory: an opaque key is not
/// an access rule, and a file shared in a private DM has to stay readable only
/// by that DM's members. So membership is re-derived from the message the
/// attachment hangs off, and an attachment not yet attached to any message is
/// readable only by whoever uploaded it.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<NextResponse | Response> {
  const user = await currentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { key: segments } = await params;
  if (!segments || segments.length === 0 || segments.some(isUnsafeSegment)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  const key = segments.join('/');

  const attachment = await prisma.attachment.findFirst({
    where: { OR: [{ storageKey: key }, { thumbnailKey: key }] },
    select: {
      storageKey: true,
      thumbnailKey: true,
      filename: true,
      mimeType: true,
      uploaderId: true,
      message: { select: { conversationId: true } },
    },
  });

  // A missing row and an unauthorised row both answer 404, so the endpoint
  // cannot be used to probe which keys exist.
  if (!attachment) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const authorised = attachment.message
    ? await isConversationMember(attachment.message.conversationId, user.id)
    : attachment.uploaderId === user.id;

  if (!authorised) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  let path: string;
  try {
    path = attachmentStorage.resolvePath(key);
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
    throw error;
  }

  let byteSize: number;
  try {
    const stats = await stat(path);
    if (!stats.isFile()) throw new Error('not a regular file');
    byteSize = stats.size;
  } catch {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const isThumbnail = attachment.thumbnailKey === key && attachment.storageKey !== key;
  // A thumbnail is only ever generated as an image; the stored mime type
  // describes the original, which may not be one.
  const mimeType = isThumbnail ? 'image/webp' : attachment.mimeType;

  // Only images are rendered in place. Everything else downloads, so a PDF or
  // an HTML-ish text file cannot be opened as a same-origin document.
  const disposition = isImageMimeType(mimeType) ? 'inline' : 'attachment';

  const stream = Readable.toWeb(attachmentStorage.openRead(key)) as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      'content-type': mimeType,
      'content-length': String(byteSize),
      'content-disposition': `${disposition}; ${contentDispositionFilename(attachment.filename)}`,
      // Keys are opaque and never reused, so the bytes behind one cannot
      // change. Private because the response depended on who asked.
      'cache-control': 'private, max-age=31536000, immutable',
      // Belt and braces alongside the disposition header: never let a stored
      // file be re-sniffed into something executable.
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}

function isUnsafeSegment(segment: string): boolean {
  return (
    segment === '' ||
    segment === '.' ||
    segment === '..' ||
    segment.includes('..') ||
    segment.includes('/') ||
    segment.includes('\\') ||
    segment.includes('\0')
  );
}

async function isConversationMember(conversationId: string, userId: string): Promise<boolean> {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  return membership !== null;
}

/// Quotes the filename for the header and repeats it RFC 5987-encoded, so a
/// name with non-ASCII characters or a quote in it survives intact.
function contentDispositionFilename(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

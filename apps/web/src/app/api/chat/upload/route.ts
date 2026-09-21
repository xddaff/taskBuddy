import { prisma } from '@studentproj/db';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { env } from '@/env';
import { attachmentStorage, StorageError } from '@/lib/storage';
import { ACCEPTED_DESCRIPTION, inspectUpload } from '@/lib/uploads';

const MAX_FILENAME_LENGTH = 200;

/// Receives one chat attachment and returns the row the composer will send
/// alongside the message.
///
/// The Attachment is created with `messageId: null`: the upload finishes while
/// the student is still typing, and `sendMessage` claims it on send. An upload
/// that is never sent stays unattached and readable only by its uploader.
export async function POST(request: Request): Promise<NextResponse> {
  const user = await currentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected a multipart form body.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was attached.' }, { status: 400 });
  }

  // Checked against the declared size first so an oversized upload is refused
  // before its bytes are pulled into memory.
  if (file.size > env.maxUploadBytes) {
    return NextResponse.json(
      { error: `Files are limited to ${formatLimit(env.maxUploadBytes)}.` },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: 'That file is empty.' }, { status: 400 });
  }
  if (bytes.byteLength > env.maxUploadBytes) {
    return NextResponse.json(
      { error: `Files are limited to ${formatLimit(env.maxUploadBytes)}.` },
      { status: 413 },
    );
  }

  const inspected = inspectUpload(bytes, file.type);
  if (!inspected) {
    return NextResponse.json(
      { error: `That file type is not accepted. Allowed: ${ACCEPTED_DESCRIPTION}.` },
      { status: 415 },
    );
  }

  let stored;
  try {
    stored = await attachmentStorage.put(bytes, { extension: inspected.extension });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[chat/upload] could not write the file:', error);
    return NextResponse.json({ error: 'Could not store the file.' }, { status: 500 });
  }

  const attachment = await prisma.attachment.create({
    data: {
      uploaderId: user.id,
      messageId: null,
      storageKey: stored.key,
      filename: safeFilename(file.name),
      mimeType: inspected.mimeType,
      byteSize: stored.byteSize,
      width: inspected.width,
      height: inspected.height,
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      byteSize: true,
      width: true,
      height: true,
      storageKey: true,
    },
  });

  return NextResponse.json({
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    byteSize: attachment.byteSize,
    width: attachment.width,
    height: attachment.height,
    url: attachmentStorage.publicUrl(attachment.storageKey),
  });
}

/// The original name is kept for display and download, with anything that could
/// read as a path stripped. It never reaches the filesystem, so this is about
/// what the UI renders rather than about traversal.
function safeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'attachment';
  return cleaned.slice(0, MAX_FILENAME_LENGTH);
}

function formatLimit(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '@/env';

/// Root of the attachment store, resolved once at module load.
///
/// Every key is resolved against this and checked to still be inside it, so a
/// crafted key cannot reach the rest of the filesystem.
const ROOT = resolve(process.cwd(), env.uploadsDir);

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export interface StoredObject {
  key: string;
  byteSize: number;
}

export interface AttachmentStorage {
  /// Writes bytes under a freshly generated key and returns it.
  put(bytes: Uint8Array, options?: { extension?: string }): Promise<StoredObject>;
  /// Absolute on-disk path for a key, or throws if the key escapes the root.
  resolvePath(key: string): string;
  /// URL the browser fetches the object through, which is authorised per
  /// request rather than served statically.
  publicUrl(key: string): string;
  openRead(key: string): Readable;
}

/// Keys are generated, never derived from the client's filename.
///
/// A filename in the path is how you get both path traversal and collisions
/// between two students uploading "screenshot.png"; the original name is kept
/// on the Attachment row for display and download instead.
function generateKey(extension?: string): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const name = randomBytes(16).toString('hex');
  const suffix = extension && /^[a-z0-9]{1,8}$/.test(extension) ? `.${extension}` : '';
  return `${year}/${month}/${name}${suffix}`;
}

function assertSafeKey(key: string): void {
  if (!key || key.includes('\0')) throw new StorageError('Invalid storage key.');
  const segments = key.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new StorageError('Invalid storage key.');
  }
}

export const attachmentStorage: AttachmentStorage = {
  async put(bytes, options) {
    if (bytes.byteLength === 0) throw new StorageError('The file is empty.');
    if (bytes.byteLength > env.maxUploadBytes) {
      throw new StorageError('The file is larger than the upload limit.');
    }

    const key = generateKey(options?.extension);
    const path = this.resolvePath(key);
    await mkdir(dirname(path), { recursive: true });
    // `wx` so a key collision fails loudly instead of silently overwriting
    // somebody else's attachment.
    await writeFile(path, bytes, { flag: 'wx' });

    return { key, byteSize: bytes.byteLength };
  },

  resolvePath(key) {
    assertSafeKey(key);
    const path = resolve(join(ROOT, key));
    if (path !== ROOT && !path.startsWith(ROOT + sep)) {
      throw new StorageError('Invalid storage key.');
    }
    return path;
  },

  publicUrl(key) {
    assertSafeKey(key);
    return `/api/chat/files/${key.split('/').map(encodeURIComponent).join('/')}`;
  },

  openRead(key) {
    return createReadStream(this.resolvePath(key));
  },
};

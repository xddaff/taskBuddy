import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '@/env';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function key(): Buffer {
  const raw = Buffer.from(env.tokenEncryptionKey(), 'base64');
  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes; got ${raw.length}. ` +
        'Generate one with: openssl rand -base64 32',
    );
  }
  return raw;
}

/// Encrypts a GitLab access token for storage.
///
/// These tokens can read everything the student can read on the instance, so
/// they are never written to the database in the clear. AES-256-GCM rather than
/// CBC so tampering is detected rather than silently decrypting to garbage.
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

export function decryptToken(encoded: string): string {
  const parts = encoded.split('.');
  if (parts.length !== 3) {
    throw new Error('Stored token is not in the expected iv.tag.ciphertext form.');
  }
  const [ivPart, tagPart, ciphertextPart] = parts as [string, string, string];

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

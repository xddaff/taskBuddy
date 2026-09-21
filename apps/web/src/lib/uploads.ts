/// Server-side validation of an uploaded file.
///
/// The type is decided from the bytes, not from the multipart `Content-Type`:
/// a client can claim anything, and an attacker's preferred claim is whichever
/// one gets their file served back with a type the browser will execute.

export interface InspectedUpload {
  mimeType: string;
  extension: string;
  width: number | null;
  height: number | null;
}

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export function isImageMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}

/// Human list for the upload button's hint and the 415 response.
export const ACCEPTED_DESCRIPTION = 'PNG, JPEG, GIF, WebP, PDF, plain text or ZIP';

/// `accept` attribute for the file picker. Advisory only; the server decides.
export const ACCEPT_ATTRIBUTE =
  'image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,.zip';

export function inspectUpload(bytes: Uint8Array, declaredMimeType: string): InspectedUpload | null {
  const sniffed = sniff(bytes);
  if (sniffed) return sniffed;

  // Plain text has no magic bytes, so it is the one case where the client's
  // claim is consulted at all, and only after the bytes are confirmed to be
  // decodable text with no control characters.
  const declared = declaredMimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (declared === 'text/plain' && looksLikeText(bytes)) {
    return { mimeType: 'text/plain', extension: 'txt', width: null, height: null };
  }

  return null;
}

function sniff(bytes: Uint8Array): InspectedUpload | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    const size = pngSize(bytes);
    return { mimeType: 'image/png', extension: 'png', ...size };
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    const size = jpegSize(bytes);
    return { mimeType: 'image/jpeg', extension: 'jpg', ...size };
  }

  if (matchesAscii(bytes, 0, 'GIF87a') || matchesAscii(bytes, 0, 'GIF89a')) {
    return {
      mimeType: 'image/gif',
      extension: 'gif',
      width: readU16LE(bytes, 6),
      height: readU16LE(bytes, 8),
    };
  }

  if (matchesAscii(bytes, 0, 'RIFF') && matchesAscii(bytes, 8, 'WEBP')) {
    const size = webpSize(bytes);
    return { mimeType: 'image/webp', extension: 'webp', ...size };
  }

  if (matchesAscii(bytes, 0, '%PDF-')) {
    return { mimeType: 'application/pdf', extension: 'pdf', width: null, height: null };
  }

  // Local file header, or the end-of-central-directory of an empty archive.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    return { mimeType: 'application/zip', extension: 'zip', width: null, height: null };
  }

  return null;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function readU16LE(bytes: Uint8Array, offset: number): number | null {
  const low = bytes[offset];
  const high = bytes[offset + 1];
  if (low === undefined || high === undefined) return null;
  return low | (high << 8);
}

function readU16BE(bytes: Uint8Array, offset: number): number | null {
  const high = bytes[offset];
  const low = bytes[offset + 1];
  if (high === undefined || low === undefined) return null;
  return (high << 8) | low;
}

function readU32BE(bytes: Uint8Array, offset: number): number | null {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];
  if (a === undefined || b === undefined || c === undefined || d === undefined) return null;
  return a * 0x1000000 + (b << 16) + (c << 8) + d;
}

interface Size {
  width: number | null;
  height: number | null;
}

function pngSize(bytes: Uint8Array): Size {
  if (!matchesAscii(bytes, 12, 'IHDR')) return { width: null, height: null };
  return { width: readU32BE(bytes, 16), height: readU32BE(bytes, 20) };
}

/// Walks JPEG segments to the start-of-frame marker, which is the only place
/// the dimensions live.
function jpegSize(bytes: Uint8Array): Size {
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === undefined) break;
    // Padding and the standalone markers carry no length field.
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    const length = readU16BE(bytes, offset + 2);
    if (length === null || length < 2) break;

    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return { height: readU16BE(bytes, offset + 5), width: readU16BE(bytes, offset + 7) };
    }

    offset += 2 + length;
  }

  return { width: null, height: null };
}

function webpSize(bytes: Uint8Array): Size {
  if (matchesAscii(bytes, 12, 'VP8X')) {
    const width = readU24LE(bytes, 24);
    const height = readU24LE(bytes, 27);
    return { width: width === null ? null : width + 1, height: height === null ? null : height + 1 };
  }

  if (matchesAscii(bytes, 12, 'VP8L')) {
    const a = bytes[21];
    const b = bytes[22];
    const c = bytes[23];
    const d = bytes[24];
    if (a === undefined || b === undefined || c === undefined || d === undefined) {
      return { width: null, height: null };
    }
    const bits = a | (b << 8) | (c << 16) | (d << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }

  if (matchesAscii(bytes, 12, 'VP8 ')) {
    const width = readU16LE(bytes, 26);
    const height = readU16LE(bytes, 28);
    return {
      width: width === null ? null : width & 0x3fff,
      height: height === null ? null : height & 0x3fff,
    };
  }

  return { width: null, height: null };
}

function readU24LE(bytes: Uint8Array, offset: number): number | null {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  if (a === undefined || b === undefined || c === undefined) return null;
  return a | (b << 8) | (c << 16);
}

/// Only the first part of the file is examined: a multi-megabyte log should not
/// cost a full strict decode to accept.
const TEXT_PROBE_BYTES = 64 * 1024;

function looksLikeText(bytes: Uint8Array): boolean {
  const probe = bytes.subarray(0, TEXT_PROBE_BYTES);

  for (const byte of probe) {
    const isAllowedControl = byte === 0x09 || byte === 0x0a || byte === 0x0d;
    if (byte < 0x20 && !isAllowedControl) return false;
    if (byte === 0x7f) return false;
  }

  try {
    // A truncated probe can cut a multi-byte sequence in half, so the tail is
    // trimmed before a strict decode rather than being reported as invalid.
    const trimmed = bytes.length > TEXT_PROBE_BYTES ? probe.subarray(0, trimToBoundary(probe)) : probe;
    new TextDecoder('utf-8', { fatal: true }).decode(trimmed);
    return true;
  } catch {
    return false;
  }
}

function trimToBoundary(probe: Uint8Array): number {
  for (let index = probe.length - 1; index >= 0 && index > probe.length - 5; index--) {
    const byte = probe[index];
    if (byte === undefined) continue;
    if ((byte & 0x80) === 0) return index + 1;
    if ((byte & 0xc0) === 0xc0) return index;
  }
  return probe.length;
}

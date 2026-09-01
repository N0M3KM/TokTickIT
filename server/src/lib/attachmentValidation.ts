import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/** Maximum file size in bytes — BR-16 */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Maximum active attachments per ticket — BR-17 */
export const MAX_ACTIVE_ATTACHMENTS = 5;

/** Allowed MIME types — BR-15 */
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/**
 * Returns true if the MIME type is in the allowed list.
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

/**
 * Returns true if the file size is within the allowed limit.
 */
export function isAllowedFileSize(bytes: number): boolean {
  return bytes <= MAX_FILE_SIZE_BYTES;
}

/**
 * Generates a safe UUID-based storage filename, preserving the original
 * file extension. Strips any path traversal characters from the extension.
 * BR-21: original filename is kept separately; this is only the storage name.
 *
 * @example sanitiseStorageFilename('../../evil.pdf') → 'a1b2c3d4-....pdf'
 */
export function sanitiseStorageFilename(originalFilename: string): string {
  // Extract only the basename to discard any path components
  const base = path.basename(originalFilename);
  const ext = path.extname(base).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return `${uuidv4()}${ext}`;
}

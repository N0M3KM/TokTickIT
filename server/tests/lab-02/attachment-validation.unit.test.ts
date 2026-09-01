import { describe, expect, it } from 'vitest';
import {
  isAllowedMimeType,
  isAllowedFileSize,
  sanitiseStorageFilename,
  MAX_FILE_SIZE_BYTES,
} from '../../src/lib/attachmentValidation.js';

describe('Attachment validation helpers — UNIT-06 to UNIT-10', () => {
  // UNIT-06: allowed MIME types pass
  describe('UNIT-06 — allowed MIME types pass validation', () => {
    it('accepts image/jpeg', () => expect(isAllowedMimeType('image/jpeg')).toBe(true));
    it('accepts image/png',  () => expect(isAllowedMimeType('image/png')).toBe(true));
    it('accepts image/webp', () => expect(isAllowedMimeType('image/webp')).toBe(true));
    it('accepts application/pdf', () => expect(isAllowedMimeType('application/pdf')).toBe(true));
  });

  // UNIT-07: disallowed MIME type fails
  describe('UNIT-07 — disallowed MIME types fail validation', () => {
    it('rejects application/octet-stream', () =>
      expect(isAllowedMimeType('application/octet-stream')).toBe(false));
    it('rejects text/plain',  () => expect(isAllowedMimeType('text/plain')).toBe(false));
    it('rejects image/gif',   () => expect(isAllowedMimeType('image/gif')).toBe(false));
    it('rejects application/exe', () => expect(isAllowedMimeType('application/exe')).toBe(false));
    it('rejects empty string',    () => expect(isAllowedMimeType('')).toBe(false));
  });

  // UNIT-08: file > 5 MB fails
  describe('UNIT-08 — file size > 5 MB fails validation', () => {
    it('rejects a file one byte over the limit', () => {
      expect(isAllowedFileSize(MAX_FILE_SIZE_BYTES + 1)).toBe(false);
    });

    it('rejects a clearly oversized file', () => {
      expect(isAllowedFileSize(10 * 1024 * 1024)).toBe(false);
    });
  });

  // UNIT-09: file exactly 5 MB passes
  describe('UNIT-09 — file size exactly 5 MB passes validation', () => {
    it('accepts a file at exactly the size limit', () => {
      expect(isAllowedFileSize(MAX_FILE_SIZE_BYTES)).toBe(true);
    });

    it('accepts a file under the limit', () => {
      expect(isAllowedFileSize(1024)).toBe(true);
    });
  });

  // UNIT-10: filename sanitiser produces safe UUID-based names
  describe('UNIT-10 — sanitiseStorageFilename produces a safe UUID-based name', () => {
    it('strips path traversal sequences from the filename', () => {
      const result = sanitiseStorageFilename('../../evil.pdf');
      expect(result).not.toContain('..');
      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
    });

    it('returns a filename matching UUID format with correct extension', () => {
      const result = sanitiseStorageFilename('report.pdf');
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/,
      );
    });

    it('preserves the extension for jpeg files', () => {
      expect(sanitiseStorageFilename('photo.jpeg')).toMatch(/\.jpeg$/);
    });

    it('produces a different name on each call (UUID uniqueness)', () => {
      const a = sanitiseStorageFilename('file.png');
      const b = sanitiseStorageFilename('file.png');
      expect(a).not.toBe(b);
    });

    it('handles filenames with no extension gracefully', () => {
      const result = sanitiseStorageFilename('noextension');
      expect(result).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});

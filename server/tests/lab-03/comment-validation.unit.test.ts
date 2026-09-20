import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Comment/Note content validation (UNIT-07)
// Pure logic — mirrors what the route handler enforces
// ---------------------------------------------------------------------------

function validateCommentContent(content: unknown): string | null {
  if (typeof content !== 'string') return 'Content is required.';
  if (content.trim().length === 0) return 'Content must not be empty or whitespace only.';
  if (content.trim().length > 2000) return 'Content must not exceed 2000 characters.';
  return null;
}

describe('UNIT-07 — comment/note content validation', () => {
  it('returns null for valid content', () => {
    expect(validateCommentContent('This is a valid comment.')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateCommentContent('')).not.toBeNull();
  });

  it('returns error for whitespace-only content', () => {
    expect(validateCommentContent('   \n\t  ')).not.toBeNull();
  });

  it('returns error for non-string value', () => {
    expect(validateCommentContent(null)).not.toBeNull();
    expect(validateCommentContent(undefined)).not.toBeNull();
  });

  it('accepts content of exactly 2000 characters', () => {
    expect(validateCommentContent('a'.repeat(2000))).toBeNull();
  });

  it('rejects content exceeding 2000 characters', () => {
    expect(validateCommentContent('a'.repeat(2001))).not.toBeNull();
  });
});

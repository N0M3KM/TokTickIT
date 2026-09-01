import { describe, expect, it } from 'vitest';
import {
  validateSummary,
  validateDescription,
  validateRequestedPriority,
  trimField,
} from '../../src/lib/ticketValidation.js';

describe('Ticket validation helpers — UNIT-03, UNIT-04, UNIT-05', () => {
  // UNIT-03: trimming
  describe('UNIT-03 — trimField removes leading/trailing whitespace', () => {
    it('trims leading and trailing whitespace', () => {
      expect(trimField('  hello  ')).toBe('hello');
    });

    it('trims tabs and newlines', () => {
      expect(trimField('\t hello \n')).toBe('hello');
    });

    it('returns empty string for non-string values', () => {
      expect(trimField(null)).toBe('');
      expect(trimField(undefined)).toBe('');
      expect(trimField(123)).toBe('');
    });
  });

  describe('validateSummary', () => {
    it('returns null for a valid summary', () => {
      expect(validateSummary('Valid summary')).toBeNull();
    });

    it('returns null for a summary of exactly 200 chars', () => {
      expect(validateSummary('a'.repeat(200))).toBeNull();
    });

    it('UNIT-03 — trims before validating: "  hello  " is valid', () => {
      expect(validateSummary('  hello  ')).toBeNull();
    });

    it('returns error for empty string', () => {
      const err = validateSummary('');
      expect(err).not.toBeNull();
      expect(err?.field).toBe('summary');
      expect(err?.message).toBe('Summary is required.');
    });

    it('returns error for whitespace-only string', () => {
      expect(validateSummary('   ')).not.toBeNull();
    });

    // UNIT-04: summary > 200 chars
    it('UNIT-04 — returns error for summary > 200 chars', () => {
      const err = validateSummary('a'.repeat(201));
      expect(err).not.toBeNull();
      expect(err?.field).toBe('summary');
      expect(err?.message).toBe('Summary must not exceed 200 characters.');
    });
  });

  describe('validateDescription', () => {
    it('returns null for a valid description', () => {
      expect(validateDescription('Valid description')).toBeNull();
    });

    it('returns null for a description of exactly 2000 chars', () => {
      expect(validateDescription('a'.repeat(2000))).toBeNull();
    });

    it('returns error for empty string', () => {
      const err = validateDescription('');
      expect(err).not.toBeNull();
      expect(err?.field).toBe('description');
    });

    // UNIT-05: description > 2000 chars
    it('UNIT-05 — returns error for description > 2000 chars', () => {
      const err = validateDescription('a'.repeat(2001));
      expect(err).not.toBeNull();
      expect(err?.field).toBe('description');
      expect(err?.message).toBe('Description must not exceed 2000 characters.');
    });
  });

  describe('validateRequestedPriority', () => {
    it('returns null for LOW', () => expect(validateRequestedPriority('LOW')).toBeNull());
    it('returns null for MEDIUM', () => expect(validateRequestedPriority('MEDIUM')).toBeNull());
    it('returns null for HIGH', () => expect(validateRequestedPriority('HIGH')).toBeNull());
    it('returns null for CRITICAL', () => expect(validateRequestedPriority('CRITICAL')).toBeNull());

    it('returns error for invalid priority', () => {
      const err = validateRequestedPriority('URGENT');
      expect(err).not.toBeNull();
      expect(err?.field).toBe('requestedPriority');
    });

    it('returns error for empty string', () => {
      expect(validateRequestedPriority('')).not.toBeNull();
    });
  });
});

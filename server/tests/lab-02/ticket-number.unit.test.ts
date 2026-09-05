import { describe, expect, it } from 'vitest';
import { formatTicketNumber } from '../../src/lib/ticketNumber.js';

describe('Ticket Number generator — UNIT-01, UNIT-02', () => {
  // UNIT-01: format matches TKT-YYYY-NNNNNN
  describe('UNIT-01 — format', () => {
    it('returns a string matching TKT-YYYY-NNNNNN', () => {
      const result = formatTicketNumber(2026, 1);
      expect(result).toMatch(/^TKT-\d{4}-\d{6}$/);
    });

    it('zero-pads the sequence number to 6 digits', () => {
      expect(formatTicketNumber(2026, 1)).toBe('TKT-2026-000001');
      expect(formatTicketNumber(2026, 42)).toBe('TKT-2026-000042');
      expect(formatTicketNumber(2026, 999999)).toBe('TKT-2026-999999');
    });

    it('uses the correct year', () => {
      expect(formatTicketNumber(2025, 1)).toBe('TKT-2025-000001');
      expect(formatTicketNumber(2030, 1)).toBe('TKT-2030-000001');
    });
  });

  // UNIT-02: sequential calls produce unique numbers
  describe('UNIT-02 — uniqueness across sequential calls', () => {
    it('produces unique ticket numbers for different sequence values', () => {
      const numbers = Array.from({ length: 100 }, (_, i) =>
        formatTicketNumber(2026, i + 1),
      );
      const unique = new Set(numbers);
      expect(unique.size).toBe(100);
    });

    it('different years with the same seq produce different numbers', () => {
      const a = formatTicketNumber(2025, 1);
      const b = formatTicketNumber(2026, 1);
      expect(a).not.toBe(b);
    });
  });
});

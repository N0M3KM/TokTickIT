import { describe, expect, it } from 'vitest';
import { IT_REQUEST_CATEGORY_NAMES } from '../../prisma/category-seed-data.js';

describe('API-02 category seed data', () => {
  it('defines the four supported IT request categories', () => {
    expect(IT_REQUEST_CATEGORY_NAMES).toEqual([
      'Account and Access',
      'Hardware',
      'Software',
      'Network',
    ]);
  });
});

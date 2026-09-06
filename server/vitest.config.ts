import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only pick up test files inside tests/ but never inside the
    // lab1-staging-docs snapshot folder (that is a reference copy, not a
    // live test suite and its React tests require a browser environment).
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/lab1-staging-docs/**'],
    environment: 'node',
  },
});

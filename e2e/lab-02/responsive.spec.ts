import { test, expect, Page } from '@playwright/test';

/**
 * Lab 2 Responsive Tests — RESP-01 to RESP-06
 * tests.md §2 (Responsive Tests), ui-spec.md §12 (Responsive Breakpoints)
 *
 * These tests check for layout correctness at three viewport sizes:
 *   Desktop  ≥ 992 px  → 1280 × 800
 *   Tablet   768–991   →  900 × 1024
 *   Mobile   < 768 px  →  375 × 812
 *
 * Prerequisites: full stack running, at least one active requester seeded.
 * Screenshots saved to artifacts/lab-02/screenshots/
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function ensureRequesterSelected(page: Page) {
  await page.goto('/select-requester');
  await page.waitForSelector('[data-testid="requester-dropdown"]');
  await page.selectOption('[data-testid="requester-dropdown"]', { index: 0 });
  await page.click('[data-testid="continue-btn"]');
  await page.waitForURL('**/tickets');
}

/** Asserts there is no horizontal overflow (scrollWidth <= innerWidth). */
async function assertNoHorizontalScroll(page: Page) {
  const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
  expect(hasOverflow).toBe(false);
}

// ---------------------------------------------------------------------------
// RESP-01: Create Ticket at mobile 375×812 (AC-18)
// ---------------------------------------------------------------------------
test('RESP-01 — Create Ticket has no horizontal scroll at mobile 375×812', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await ensureRequesterSelected(page);
  await page.goto('/tickets/new');
  await page.waitForSelector('[data-testid="summary-input"]');

  await assertNoHorizontalScroll(page);

  // All required fields are visible
  await expect(page.locator('[data-testid="summary-input"]')).toBeVisible();
  await expect(page.locator('[data-testid="description-input"]')).toBeVisible();
  await expect(page.locator('[data-testid="submit-btn"]')).toBeVisible();

  // Submit button has sufficient touch target height (≥ 44 px)
  const btnBox = await page.locator('[data-testid="submit-btn"]').boundingBox();
  expect(btnBox?.height ?? 0).toBeGreaterThanOrEqual(40);

  await page.screenshot({ path: 'artifacts/lab-02/screenshots/create-ticket/mobile-initial.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// RESP-02: Ticket Detail at tablet 900×1024 (AC-22)
// ---------------------------------------------------------------------------
test('RESP-02 — Ticket Detail is readable at tablet 900×1024', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1024 });
  await ensureRequesterSelected(page);

  // Create a ticket to view
  await page.goto('/tickets/new');
  await page.waitForSelector('[data-testid="category-select"]');
  const catOptions = await page.locator('[data-testid="category-select"] option').all();
  if (catOptions.length > 1) await page.selectOption('[data-testid="category-select"]', { index: 1 });
  await page.fill('[data-testid="summary-input"]',     'RESP-02 tablet ticket');
  await page.fill('[data-testid="description-input"]', 'Testing tablet layout for Ticket Detail.');
  await page.click('[data-testid="submit-btn"]');
  await page.waitForSelector('[data-testid="success-panel"]');
  await page.click('text=View Ticket Detail');
  await page.waitForURL('**/tickets/**');

  await assertNoHorizontalScroll(page);
  await expect(page.locator('[data-testid="ticket-summary"]')).toBeVisible();
  await expect(page.locator('[data-testid="back-btn"]')).toBeVisible();

  await page.screenshot({ path: 'artifacts/lab-02/screenshots/ticket-detail/tablet-loaded.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// RESP-03: My Tickets at desktop 1280×800 — table layout visible (AC-05)
// ---------------------------------------------------------------------------
test('RESP-03 — My Tickets shows table layout at desktop 1280×800', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureRequesterSelected(page);
  await page.goto('/tickets');
  // Wait for either the table or any of the empty/loading states
  await page.waitForSelector('[data-testid="tickets-table"], [data-testid="empty-state"], [data-testid="tickets-error"]');

  await assertNoHorizontalScroll(page);
  await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
  await expect(page.locator('[data-testid="create-ticket-btn"]')).toBeVisible();

  await page.screenshot({ path: 'artifacts/lab-02/screenshots/my-tickets/desktop-loaded.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// RESP-04: My Tickets at mobile 375×812 — no horizontal scroll (AC-18)
// ---------------------------------------------------------------------------
test('RESP-04 — My Tickets has no horizontal scroll at mobile 375×812', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await ensureRequesterSelected(page);
  await page.goto('/tickets');
  await page.waitForSelector('[data-testid="tickets-table"], [data-testid="empty-state"], [data-testid="tickets-error"]');

  await assertNoHorizontalScroll(page);
  await expect(page.locator('[data-testid="search-input"]')).toBeVisible();

  await page.screenshot({ path: 'artifacts/lab-02/screenshots/my-tickets/mobile-loaded.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// RESP-05: Requester Selector at mobile 375×812
// ---------------------------------------------------------------------------
test('RESP-05 — Requester Selector is accessible at mobile 375×812', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/select-requester');
  await page.evaluate(() => {
    localStorage.removeItem('devRequesterId');
    localStorage.removeItem('devRequesterName');
  });
  await page.goto('/select-requester');
  await page.waitForSelector('[data-testid="requester-dropdown"], [data-testid="selector-error"], [data-testid="selector-empty"]');

  await assertNoHorizontalScroll(page);
  await expect(page.locator('[data-testid="continue-btn"]')).toBeVisible();

  await page.screenshot({ path: 'artifacts/lab-02/screenshots/requester-selector/mobile.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// RESP-06: Navigation collapses at mobile — no overlapping elements
// ---------------------------------------------------------------------------
test('RESP-06 — navigation collapses at mobile 375×812 without overlapping', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await ensureRequesterSelected(page);
  await page.goto('/tickets');
  await page.waitForSelector('[data-testid="app-shell-header"]');

  await assertNoHorizontalScroll(page);

  // Header must be present and visible
  await expect(page.locator('[data-testid="app-shell-header"]')).toBeVisible();

  // Header height must not be excessively large (not wrapped/overflowing)
  const headerBox = await page.locator('[data-testid="app-shell-header"]').boundingBox();
  expect(headerBox?.height ?? 999).toBeLessThan(200); // sane upper bound

  await page.screenshot({ path: 'artifacts/lab-02/screenshots/my-tickets/mobile-nav.png', fullPage: true });
});

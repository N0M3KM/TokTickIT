import { test, expect, Page } from '@playwright/test';
import path from 'path';

/**
 * Lab 2 E2E Tests — Requester Ticket Flow
 * tests.md §2 (E2E-01 to E2E-10)
 * specification.md AC-01 to AC-23
 *
 * Prerequisites: full stack running
 *   client: http://localhost:5173
 *   server: http://localhost:3000
 *   database seeded (npx prisma db seed)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Select a requester by name from the selector screen. */
async function selectRequester(page: Page, name: string) {
  await page.goto('/select-requester');
  await page.waitForSelector('[data-testid="requester-dropdown"]');
  await page.selectOption('[data-testid="requester-dropdown"]', { label: name });
  await page.click('[data-testid="continue-btn"]');
  await page.waitForURL('**/tickets');
}

/** Fill and submit the Create Ticket form with valid data. */
async function createTicket(page: Page, summary: string, description: string) {
  await page.goto('/tickets/new');
  await page.waitForSelector('[data-testid="category-select"]');

  // Select first available category
  const catOptions = await page.locator('[data-testid="category-select"] option').all();
  if (catOptions.length > 1) {
    await page.selectOption('[data-testid="category-select"]', { index: 1 });
  }

  await page.fill('[data-testid="summary-input"]',     summary);
  await page.fill('[data-testid="description-input"]', description);
  await page.click('[data-testid="submit-btn"]');
  await page.waitForSelector('[data-testid="success-panel"]');

  const ticketNumber = await page.locator('[data-testid="ticket-number-display"]').textContent();
  return ticketNumber?.trim() ?? '';
}

// ---------------------------------------------------------------------------
// E2E-01: Complete ticket creation flow → ticket appears in My Tickets (AC-01, AC-05)
// ---------------------------------------------------------------------------
test('E2E-01 — create ticket, see ticket number, find in My Tickets', async ({ page }) => {
  await selectRequester(page, 'Somchai Jaidee');

  const ticketNumber = await createTicket(
    page,
    'E2E-01 battery drains quickly',
    'Battery drains faster than usual after Windows update.',
  );

  // Ticket number matches expected format
  expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);

  // Navigate to My Tickets and find the ticket
  await page.goto('/tickets');
  await page.waitForSelector('[data-testid="tickets-table"]');
  await expect(page.getByText(ticketNumber)).toBeVisible();
});

// ---------------------------------------------------------------------------
// E2E-02: Navigate to /tickets without a requester → redirected to selector (AC-02)
// ---------------------------------------------------------------------------
test('E2E-02 — no requester selected redirects to selector screen', async ({ page }) => {
  // Clear any stored requester
  await page.goto('/select-requester');
  await page.evaluate(() => {
    localStorage.removeItem('devRequesterId');
    localStorage.removeItem('devRequesterName');
  });

  // Navigate directly to /tickets
  await page.goto('/tickets');

  // Should redirect to selector
  await expect(page).toHaveURL(/select-requester/);
  await expect(page.getByText('Select Development Requester')).toBeVisible();
});

// ---------------------------------------------------------------------------
// E2E-03: Direct access to another requester's ticket returns permission error (AC-03, BR-07)
// ---------------------------------------------------------------------------
test('E2E-03 — cross-requester ticket access shows permission error', async ({ page }) => {
  // Select Requester A and create a ticket
  await selectRequester(page, 'Somchai Jaidee');
  const ticketNumber = await createTicket(
    page,
    'E2E-03 requester A ticket',
    'This ticket belongs to Requester A.',
  );

  // Get the ticket ID from the URL after clicking View Ticket Detail
  await page.click('text=View Ticket Detail');
  await page.waitForURL('**/tickets/**');
  const urlA = page.url();
  const ticketId = urlA.split('/tickets/')[1];

  // Switch to Requester B
  await page.click('[data-testid="change-requester-btn"]');
  await page.waitForURL('**/select-requester');
  await page.selectOption('[data-testid="requester-dropdown"]', { label: 'Nattaporn Srisuk' });
  await page.click('[data-testid="continue-btn"]');
  await page.waitForURL('**/tickets');

  // Try to access Requester A's ticket directly
  await page.goto(`/tickets/${ticketId}`);

  // Should show permission error
  await expect(page.locator('[data-testid="forbidden-error"]')).toBeVisible();
  expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
});

// ---------------------------------------------------------------------------
// E2E-04: Switching requester clears ticket list (BR-06, AC-16)
// ---------------------------------------------------------------------------
test('E2E-04 — switching requester reloads ticket list for new requester', async ({ page }) => {
  // Select Requester A
  await selectRequester(page, 'Somchai Jaidee');

  // Create a uniquely identifiable ticket for Requester A
  const markerSummary = `E2E-04-RequesterA-${Date.now()}`;
  await createTicket(page, markerSummary, 'Belongs to Requester A only.');

  // Go to My Tickets and confirm the ticket appears
  await page.goto('/tickets');
  await page.waitForSelector('[data-testid="tickets-table"]');
  await expect(page.getByText(markerSummary)).toBeVisible();

  // Switch to Requester B
  await page.click('[data-testid="change-requester-btn"]');
  await page.waitForURL('**/select-requester');
  await page.selectOption('[data-testid="requester-dropdown"]', { label: 'Nattaporn Srisuk' });
  await page.click('[data-testid="continue-btn"]');
  await page.waitForURL('**/tickets');
  await page.waitForTimeout(500);

  // Requester A's ticket should NOT be visible
  await expect(page.getByText(markerSummary)).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// E2E-05: Attachment lifecycle — upload, download, soft-remove (AC-09, AC-10, AC-11)
// ---------------------------------------------------------------------------
test('E2E-05 — attachment upload, download, soft-remove lifecycle', async ({ page }) => {
  await selectRequester(page, 'Somchai Jaidee');

  // Create a ticket
  await createTicket(page, 'E2E-05 attachment lifecycle', 'Testing attachment upload and removal.');
  await page.click('text=View Ticket Detail');
  await page.waitForURL('**/tickets/**');

  // Upload a small PDF attachment
  const pdfBuffer = Buffer.from('%PDF-1.4 test content for E2E');
  await page.setInputFiles('[data-testid="attachment-file-input"]', {
    name: 'e2e-test.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBuffer,
  });

  // Wait for attachment to appear with Download button
  await page.waitForSelector('[data-testid^="download-btn-"]');
  const attachmentId = await page.locator('[data-testid^="download-btn-"]').first().getAttribute('data-testid');
  const id = attachmentId?.replace('download-btn-', '');

  // Soft-remove the attachment
  await page.click(`[data-testid="remove-btn-${id}"]`);
  await page.waitForSelector('[role="dialog"]');
  await page.fill('[data-testid="removal-reason-input"]', 'E2E test removal reason');
  await page.click('[data-testid="dialog-confirm-btn"]');

  // Removed badge should appear; no download button
  await expect(page.locator(`[data-testid="removed-badge-${id}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="download-btn-${id}"]`)).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// E2E-06: 6th attachment upload is rejected (BR-17, AC-08)
// ---------------------------------------------------------------------------
test('E2E-06 — uploading 6th active attachment is rejected', async ({ page }) => {
  await selectRequester(page, 'Somchai Jaidee');
  await createTicket(page, 'E2E-06 attachment limit test', 'Testing max 5 attachments.');
  await page.click('text=View Ticket Detail');
  await page.waitForURL('**/tickets/**');

  const pdfBuffer = Buffer.from('%PDF-1.4 test');

  // Upload 5 attachments
  for (let i = 1; i <= 5; i++) {
    await page.setInputFiles('[data-testid="attachment-file-input"]', {
      name: `attachment-${i}.pdf`,
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    });
    await page.waitForTimeout(400);
  }

  // Add Attachment button should now be disabled
  const addBtn = page.locator('[data-testid="add-attachment-btn"]');
  await expect(addBtn).toBeDisabled();
});

// ---------------------------------------------------------------------------
// E2E-07: Search and clear filters (AC-12, AC-14)
// ---------------------------------------------------------------------------
test('E2E-07 — search filters tickets; clear restores full list', async ({ page }) => {
  await selectRequester(page, 'Somchai Jaidee');

  // Create a ticket with a unique searchable summary
  const uniqueSummary = `E2E-07-search-${Date.now()}`;
  await createTicket(page, uniqueSummary, 'Unique ticket for search test.');

  await page.goto('/tickets');
  await page.waitForSelector('[data-testid="search-input"]');

  // Search for the unique term
  await page.fill('[data-testid="search-input"]', uniqueSummary);
  await page.waitForTimeout(400); // debounce

  // Only matching ticket(s) visible — the unique summary should be in results
  await expect(page.getByText(uniqueSummary)).toBeVisible();

  // Search for something that matches nothing
  await page.fill('[data-testid="search-input"]', 'zzz-no-match-at-all-xyz');
  await page.waitForTimeout(400);
  await expect(page.locator('[data-testid="no-results-state"]')).toBeVisible();

  // Clear search and confirm full list restored
  await page.fill('[data-testid="search-input"]', '');
  await page.waitForTimeout(400);
  await expect(page.locator('[data-testid="no-results-state"]')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// E2E-08: Submit Create Ticket with all required fields empty → all field errors (AC-23)
// ---------------------------------------------------------------------------
test('E2E-08 — submitting empty form shows all required field errors', async ({ page }) => {
  await selectRequester(page, 'Somchai Jaidee');
  await page.goto('/tickets/new');
  await page.waitForSelector('[data-testid="category-select"]');

  // Clear the auto-selected category
  await page.selectOption('[data-testid="category-select"]', '');

  await page.click('[data-testid="submit-btn"]');

  // All required field errors must appear simultaneously
  await expect(page.locator('[data-testid="summary-error"]')).toBeVisible();
  await expect(page.locator('[data-testid="description-error"]')).toBeVisible();
  await expect(page.getByText(/category is required/i)).toBeVisible();
});

// ---------------------------------------------------------------------------
// E2E-09: Ticket saved but attachment upload fails → partial-success panel (AC-21, BR-20)
// ---------------------------------------------------------------------------
test('E2E-09 — ticket saved but attachment upload fails shows partial-success', async ({ page }) => {
  await selectRequester(page, 'Somchai Jaidee');
  await page.goto('/tickets/new');
  await page.waitForSelector('[data-testid="category-select"]');

  // Select a category
  const catOptions = await page.locator('[data-testid="category-select"] option').all();
  if (catOptions.length > 1) {
    await page.selectOption('[data-testid="category-select"]', { index: 1 });
  }

  await page.fill('[data-testid="summary-input"]',     'E2E-09 partial success test');
  await page.fill('[data-testid="description-input"]', 'Testing partial success state.');

  // Stage a valid PDF
  const pdfBuffer = Buffer.from('%PDF-1.4 valid content');
  await page.setInputFiles('[data-testid="file-input"]', {
    name: 'test.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBuffer,
  });

  // Intercept the attachment upload and make it fail
  await page.route('**/attachments', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Upload failed' } }) });
    } else {
      route.continue();
    }
  });

  await page.click('[data-testid="submit-btn"]');

  // Partial-success panel must appear with link to Ticket Detail
  await expect(page.locator('[data-testid="partial-success-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="view-ticket-detail-link"]')).toBeVisible();
});

// ---------------------------------------------------------------------------
// E2E-10: Pagination navigates to page 2 correctly (AC-15, FR-11)
// ---------------------------------------------------------------------------
test('E2E-10 — pagination shows page 2 with different tickets', async ({ page }) => {
  await selectRequester(page, 'Somchai Jaidee');

  // Create 11 tickets to guarantee pagination exists
  for (let i = 1; i <= 11; i++) {
    await page.goto('/tickets/new');
    await page.waitForSelector('[data-testid="category-select"]');
    const catOptions = await page.locator('[data-testid="category-select"] option').all();
    if (catOptions.length > 1) await page.selectOption('[data-testid="category-select"]', { index: 1 });
    await page.fill('[data-testid="summary-input"]',     `E2E-10 pagination ticket ${i}`);
    await page.fill('[data-testid="description-input"]', `Pagination test ticket number ${i}`);
    await page.click('[data-testid="submit-btn"]');
    await page.waitForSelector('[data-testid="success-panel"]');
  }

  await page.goto('/tickets');
  await page.waitForSelector('[data-testid="pagination"]');

  // Collect page 1 ticket numbers
  const page1Numbers = await page.locator('[data-testid="tickets-table"] tbody tr td:first-child').allTextContents();

  // Navigate to page 2
  const page2Btn = page.locator('[data-testid="pagination-page-2"]');
  await expect(page2Btn).toBeVisible();
  await page2Btn.click();
  await page.waitForTimeout(300);

  // Page 2 tickets must differ from page 1
  const page2Numbers = await page.locator('[data-testid="tickets-table"] tbody tr td:first-child').allTextContents();
  const overlap = page1Numbers.filter((n) => page2Numbers.includes(n));
  expect(overlap).toHaveLength(0);
});

import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

if (process.env.WORKFLOW_TEST_DATABASE !== 'isolated-runner') throw new Error('Use the isolated requester dashboard browser runner.');
const prisma = new PrismaClient();
test.afterAll(async () => { await prisma.$disconnect(); });

test('owned dashboard totals, real drill-downs, Back/reload and role-safe landing', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(process.env.DASHBOARD_REQUESTER_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.DASHBOARD_BROWSER_PASSWORD!);
  const dashboardResponse = page.waitForResponse(response => response.url().endsWith('/api/dashboards/requester') && response.ok());
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const dashboard = await (await dashboardResponse).json();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page');
  const requesterId = Number(process.env.DASHBOARD_REQUESTER_ID);
  const from = new Date(dashboard.window.from), to = new Date(dashboard.window.to);
  // Independent SQL, using the returned snapshot boundaries and session fixture ID.
  const [counts] = await prisma.$queryRaw<{ open: number; waiting: number; resolved: number; updated: number }[]>`
    SELECT COUNT(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED'))::int AS open,
    COUNT(*) FILTER (WHERE "currentStatus"='WAITING_FOR_REQUESTER')::int AS waiting,
    COUNT(*) FILTER (WHERE "currentStatus" IN ('RESOLVED','CLOSED') AND "resolvedAt">=${from} AND "resolvedAt"<${to})::int AS resolved,
    COUNT(*) FILTER (WHERE "updatedAt">=${from} AND "updatedAt"<${to})::int AS updated
    FROM "Ticket" WHERE "requesterId"=${requesterId}`;
  expect(dashboard.metrics.open.count).toBe(counts.open);
  expect(dashboard.metrics.waiting.count).toBe(counts.waiting);
  expect(dashboard.metrics.recentlyResolved.count).toBe(counts.resolved);
  expect(dashboard.metrics.recentlyUpdated.count).toBe(counts.updated);
  expect(JSON.stringify(dashboard)).not.toContain('PRIVATE_DESCRIPTION_NOT_IN_DASHBOARD');
  expect(JSON.stringify(dashboard)).not.toContain('OTHER_ACCOUNT_SECRET');
  await expect(page.getByRole('link', { name: `View ${counts.open} open tickets`, exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recently updated tickets', exact: true }).getByRole('listitem')).toHaveCount(5);
  await expect(page.getByText(/Estimated from legacy record/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: `artifacts/lab-04/screenshots/requester-dashboard/${testInfo.project.name}-real-dashboard.png`, fullPage: true });

  const openResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/tickets' && response.ok());
  await page.getByRole('link', { name: `View ${counts.open} open tickets`, exact: true }).click();
  expect((await (await openResponse).json()).pagination.total).toBe(counts.open);
  await expect(page.getByRole('heading', { name: 'My Tickets', exact: true })).toBeVisible();
  await expect(page.getByTestId('pagination-next')).toBeEnabled();
  await page.getByTestId('pagination-next').click();
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('heading', { name: 'My Tickets', exact: true })).toBeVisible();
  await page.goto('/dashboard');
  await page.getByRole('link', { name: `View ${counts.resolved} recently resolved tickets`, exact: true }).click();
  const resolvedUrl = new URL(page.url());
  expect(resolvedUrl.searchParams.get('from')).toBeTruthy();
  expect(resolvedUrl.searchParams.get('to')).toBeTruthy();
  await page.reload();
  await expect(page.getByText(/Dashboard order: newest resolution first/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sort descending', exact: true })).toBeDisabled();
  const link = page.locator('a[href^="/tickets/"]').filter({ hasNotText: /Create Ticket/ }).filter({ visible: true }).first();
  // Locator visibility is asserted independently for desktop-table/mobile-card layouts.
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByTestId('ticket-summary')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(resolvedUrl.toString());
  await expect(page.getByText(/Dashboard order: newest resolution first/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: `artifacts/lab-04/screenshots/requester-dashboard/${testInfo.project.name}-real-drilldown.png`, fullPage: true });

  const logout = await page.request.post('/api/auth/logout'); expect(logout.ok()).toBe(true);
  const emptyLogin = await page.request.post('/api/auth/login', { data: { email: process.env.DASHBOARD_EMPTY_EMAIL, password: process.env.DASHBOARD_BROWSER_PASSWORD } });
  expect(emptyLogin.ok()).toBe(true); await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: 'View 0 open tickets', exact: true })).toBeVisible();
  await expect(page.getByText('No recently updated tickets', { exact: true })).toBeVisible();
  await expect(page.getByText(/Dashboard support request/)).toHaveCount(0);
  await page.screenshot({ path: `artifacts/lab-04/screenshots/requester-dashboard/${testInfo.project.name}-real-empty.png`, fullPage: true });
  await page.request.post('/api/auth/logout');
  const staffLogin = await page.request.post('/api/auth/login', { data: { email: process.env.DASHBOARD_STAFF_EMAIL, password: process.env.DASHBOARD_BROWSER_PASSWORD } });
  expect(staffLogin.ok()).toBe(true); await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/queue$/);
  expect((await page.request.get('/api/dashboards/requester')).status()).toBe(403);
  await page.request.post('/api/auth/logout');
  const adminLogin = await page.request.post('/api/auth/login', { data: { email: process.env.DASHBOARD_ADMIN_EMAIL, password: process.env.DASHBOARD_BROWSER_PASSWORD } });
  expect(adminLogin.ok()).toBe(true); await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/admin\/users$/);
  expect(errors).toEqual([]);
});

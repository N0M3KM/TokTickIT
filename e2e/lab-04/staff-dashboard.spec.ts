import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

if (process.env.WORKFLOW_TEST_DATABASE !== 'isolated-runner') throw new Error('Use the disposable staff dashboard browser runner.');
const prisma = new PrismaClient();
test.afterAll(async () => { await prisma.$disconnect(); });
test('staff/admin operational metrics, assigned action anchors and queue drill-downs persist', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(process.env.STAFF_BROWSER_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.STAFF_BROWSER_PASSWORD!);
  const snapshotResponse = page.waitForResponse(response => response.url().endsWith('/api/dashboards/staff') && response.ok());
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const snapshot = await (await snapshotResponse).json();
  await expect(page.getByText('Operational overview', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  const actor = Number(process.env.STAFF_BROWSER_ID), from = new Date(snapshot.window.from), to = new Date(snapshot.window.to);
  const [expected] = await prisma.$queryRaw<{ unassigned: number; mine: number; recent: number }[]>`
    SELECT COUNT(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED') AND "ticketOwnerId" IS NULL)::int AS unassigned,
    COUNT(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED') AND "ticketOwnerId"=${actor})::int AS mine,
    COUNT(*) FILTER (WHERE "updatedAt">=${from} AND "updatedAt"<${to})::int AS recent FROM "Ticket"`;
  expect(snapshot.metrics.unassigned.count).toBe(expected.unassigned);
  expect(snapshot.metrics.ownedByMe.count).toBe(expected.mine);
  expect(snapshot.metrics.recentlyUpdated.count).toBe(expected.recent);
  const groups = await prisma.$queryRaw<{ currentStatus: string; count: number }[]>`SELECT "currentStatus",COUNT(*)::int AS count FROM "Ticket" GROUP BY "currentStatus"`;
  expect(snapshot.metrics.byStatus).toHaveLength(8);
  for (const bucket of snapshot.metrics.byStatus) expect(bucket.count).toBe(groups.find(row => row.currentStatus === bucket.status)?.count ?? 0);
  expect(snapshot.metrics.byPriority).toHaveLength(4);
  expect(snapshot.myActions.actionCount).toBe(2);
  expect(snapshot.myActions.ticketCount).toBe(1);
  expect(snapshot.myActions.items[0].id).toBe(Number(process.env.STAFF_BROWSER_ACTION_ID));
  expect(snapshot.myActions.items.every((item: { description: string }) => item.description.length <= 120)).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain('PRIVATE_TICKET_DESCRIPTION');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: `artifacts/lab-04/screenshots/staff-dashboard/${testInfo.project.name}-real-staff.png`, fullPage: true });

  const related = page.locator('a[href="/queue?dashboardFilter=myActions"]').filter({ visible: true }).first();
  await related.click();
  await expect(page.getByRole('heading', { name: 'My Queue', exact: true })).toBeVisible();
  const relatedResponse = await page.request.get('/api/queue?dashboardFilter=myActions');
  expect((await relatedResponse.json()).pagination.total).toBe(1);
  await page.reload();
  await expect(page).toHaveURL(/dashboardFilter=myActions/);
  await expect(page.getByRole('heading', { name: 'My Queue', exact: true })).toBeVisible();
  await page.goto('/dashboard');
  const actionId = process.env.STAFF_BROWSER_ACTION_ID!, ticketId = process.env.STAFF_BROWSER_TICKET_ID!;
  await page.locator(`a[href="/tickets/${ticketId}#action-${actionId}"]`).first().click();
  const pinned = page.getByRole('region', { name: `Linked action ${actionId}`, exact: true });
  await expect(pinned).toBeVisible(); await expect(pinned).toBeFocused();
  await expect(pinned.getByText(/long shared action text/)).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Operational overview', { exact: true })).toBeVisible();
  await page.locator('a[href="/queue?dashboardFilter=ownedByMe"]').first().click();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/page=2/); await page.reload();
  await expect(page).toHaveURL(/page=2/);
  await page.goto('/dashboard');
  await page.locator('a[href^="/queue?dashboardFilter=recentlyUpdated"]').first().click();
  const recentUrl = page.url();
  expect(new URL(recentUrl).searchParams.get('from')).toBeTruthy();
  await page.reload(); await expect(page).toHaveURL(recentUrl);
  await expect(page.getByRole('heading', { name: 'My Queue', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: `artifacts/lab-04/screenshots/staff-dashboard/${testInfo.project.name}-real-queue.png`, fullPage: true });

  async function switchAccount(email: string) {
    expect((await page.request.post('/api/auth/logout')).ok()).toBe(true);
    expect((await page.request.post('/api/auth/login', { data: { email, password: process.env.STAFF_BROWSER_PASSWORD } })).ok()).toBe(true);
    await page.goto('/'); await expect(page).toHaveURL(/\/dashboard$/);
  }
  await switchAccount(process.env.STAFF_BROWSER_ADMIN_EMAIL!);
  await expect(page.getByText('Operational overview', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'User Management', exact: true })).toBeVisible();
  const adminSnapshot = await (await page.request.get('/api/dashboards/staff')).json();
  expect(adminSnapshot.myActions.actionCount).toBe(1); expect(adminSnapshot.myActions.ticketCount).toBe(1);
  expect(adminSnapshot.metrics.byStatus).toEqual(snapshot.metrics.byStatus);
  await page.screenshot({ path: `artifacts/lab-04/screenshots/staff-dashboard/${testInfo.project.name}-real-admin.png`, fullPage: true });
  await switchAccount(process.env.STAFF_BROWSER_EMPTY_EMAIL!);
  const emptySnapshot = await (await page.request.get('/api/dashboards/staff')).json();
  expect(emptySnapshot.myActions.actionCount).toBe(0); expect(emptySnapshot.metrics.ownedByMe.count).toBe(0);
  await expect(page.getByText('No actions assigned to you', { exact: true })).toBeVisible();
  await switchAccount(process.env.STAFF_BROWSER_REQUESTER_EMAIL!);
  await expect(page.getByText('My service requests', { exact: true })).toBeVisible();
  expect((await page.request.get('/api/dashboards/staff')).status()).toBe(403);
  expect(errors).toEqual([]);
});

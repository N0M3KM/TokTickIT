import { expect, test } from '@playwright/test';

// Real HTTP auth/API/Prisma/PostgreSQL. No route interception or mocked writes.
test('persists actions, resolves, requester reopens and enforces fresh work', async ({ page }, testInfo) => {
  const id = JSON.parse(process.env.WORKFLOW_BROWSER_TICKET_IDS!)[testInfo.project.name];
  const path = `/tickets/${id}`;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  async function login(email: string) {
    const response = await page.request.post('/api/auth/login', { data: { email, password: process.env.WORKFLOW_BROWSER_PASSWORD } });
    expect(response.status()).toBe(200);
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Actions Taken', exact: true })).toBeVisible();
  }
  await login(process.env.WORKFLOW_BROWSER_STAFF_EMAIL!);
  const workflow = page.getByRole('region', { name: 'Ticket workflow', exact: true });
  await expect(workflow.getByRole('list', { name: 'Resolution requirements' })).toContainText('Complete an action before resolving.');
  const denied = await page.request.patch(`/api/tickets/${id}/status`, { data: { expectedVersion: 1, status: 'RESOLVED' } });
  expect(denied.status()).toBe(409);
  expect((await denied.json()).error.details.reasons).toContain('NO_COMPLETED_ACTION');

  await page.getByRole('button', { name: 'Add action', exact: true }).click();
  await page.getByLabel('Action description', { exact: false }).fill('Replace faulty network adapter');
  // Both form families may have unsaved values; only one router guard is installed.
  await workflow.getByRole('combobox', { name: 'IT Priority', exact: true }).selectOption('HIGH');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByTestId('back-btn').click();
  await expect(page.getByLabel('Action description', { exact: false })).toHaveValue('Replace faulty network adapter');
  await expect(workflow).toHaveCount(1);
  page.once('dialog', dialog => dialog.accept());
  await workflow.getByRole('button', { name: 'Discard workflow changes' }).click();
  await page.getByRole('button', { name: 'Save action', exact: true }).click();
  await expect(page.getByText('Action saved.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Edit action \d+$/ }).click();
  await page.getByRole('button', { name: 'Start action', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Edit action \d+$/ })).toBeVisible();
  await page.getByRole('button', { name: /^Edit action \d+$/ }).click();
  await page.getByLabel('Result', { exact: false }).fill('Connectivity verified with requester');
  await page.getByRole('button', { name: 'Complete action', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm complete action', exact: true }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(workflow.getByRole('list', { name: 'Resolution requirements' })).toHaveCount(0);
  await workflow.getByRole('combobox', { name: 'Current Status', exact: true }).selectOption('RESOLVED');
  await workflow.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(workflow.getByText('Ticket updated.', { exact: true })).toBeVisible();
  await expect(workflow.getByText(/^Resolved:/)).toBeVisible();
  await expect(page.getByText('Reopen the ticket before recording more work.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: `artifacts/lab-04/screenshots/ticket-workflow/${testInfo.project.name}-real-resolved.png`, fullPage: true });

  await page.request.post('/api/auth/logout');
  await login(process.env.WORKFLOW_BROWSER_REQUESTER_EMAIL!);
  await expect(page.getByRole('button', { name: 'Add action', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Internal Notes', exact: true })).toHaveCount(0);
  await workflow.getByRole('button', { name: 'Reopen ticket', exact: true }).click();
  await expect(workflow.getByText('Ticket reopened. Fresh completed work is required before resolving again.')).toBeVisible();
  await page.request.post('/api/auth/logout');
  await login(process.env.WORKFLOW_BROWSER_STAFF_EMAIL!);
  await workflow.getByRole('combobox', { name: 'Current Status', exact: true }).selectOption('IN_PROGRESS');
  await workflow.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(workflow.getByText('Ticket updated.', { exact: true })).toBeVisible();
  await expect(workflow.getByRole('list', { name: 'Resolution requirements' })).toContainText('Complete fresh work after reopening before resolving again.');
  const detail = await (await page.request.get(`/api/tickets/${id}`)).json();
  const blocked = await page.request.patch(`/api/tickets/${id}/status`, { data: { expectedVersion: detail.version, status: 'RESOLVED' } });
  expect(blocked.status()).toBe(409);
  expect((await blocked.json()).error.details.reasons).toContain('FRESH_WORK_REQUIRED');
  const history = await (await page.request.get(`/api/tickets/${id}/history`)).json();
  expect(history.data.filter((event: { kind: string }) => event.kind === 'STATUS')).toHaveLength(3);
  await page.screenshot({ path: `artifacts/lab-04/screenshots/ticket-workflow/${testInfo.project.name}-real-reopened.png`, fullPage: true });
  expect(errors).toEqual([]);
});

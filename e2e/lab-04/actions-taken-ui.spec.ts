import { expect, test } from '@playwright/test';

// Contract-mocked browser checks. These do NOT prove database persistence.
const staff = { id: 5, name: 'Staff A', role: 'IT_STAFF', mustChangePassword: false };
const actor = { id: 5, name: 'Staff A', role: 'IT_STAFF' };
const baseAction = {
  id: 101, ticketId: 42, actionAt: '2026-10-01T02:00:00.000Z', description: 'Inspect adapter',
  result: null, performedBy: actor, assignee: { ...actor, isActive: true }, followUpRequired: false,
  followUpNote: null, attachmentNotes: 'adapter.png', status: 'PLANNED', cancellationReason: null,
  version: 1, updatedBy: actor, createdAt: '2026-10-01T02:00:00.000Z', updatedAt: '2026-10-01T02:00:00.000Z',
};

test('contract-mocked action create, lifecycle, navigation and responsive UI', async ({ page }, testInfo) => {
  let actions = [baseAction];
  let ticketVersion = 8;
  const writes: { method: string; body: Record<string, unknown>; key?: string }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let body: unknown;
    if (path === '/api/auth/me') body = staff;
    else if (path === '/api/queue/owners') body = [{ id: 5, name: 'Staff A' }, { id: 6, name: 'Staff B' }];
    else if (path === '/api/tickets/42') body = {
      id: 42, ticketNumber: 'LAB4-42', requesterId: 1, requesterName: 'Requester A', categoryId: 1,
      categoryName: 'Network', relatedSystemId: null, relatedSystemName: null, summary: 'Adapter failure',
      description: 'Connection drops', requestedPriority: 'MEDIUM', itPriority: 'MEDIUM', currentStatus: 'OPEN',
      ticketOwnerId: 5, requesterResolvedAt: null, ticketDate: '2026-10-01T00:00:00Z',
      createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', attachments: [], version: ticketVersion,
    };
    else if (/\/(comments|notes)$/.test(path)) body = [];
    else if (path === '/api/tickets/42/actions' && method === 'GET') body = { data: actions, pagination: { page: 1, pageSize: 10, total: actions.length, totalPages: 1 }, ticketVersion };
    else if (path.endsWith('/history')) body = { data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } };
    else if (path === '/api/tickets/42/actions' && method === 'POST') {
      const input = route.request().postDataJSON();
      writes.push({ method, body: input, key: route.request().headers()['idempotency-key'] });
      const created = { ...baseAction, ...input, id: 102, assignee: { ...actor, id: input.assigneeId, isActive: true } };
      actions = [...actions, created]; ticketVersion++;
      body = { data: created, ticketVersion };
    } else if (/\/actions\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1));
      let action = actions.find(item => item.id === id)!;
      if (method === 'PATCH') {
        const input = route.request().postDataJSON(); writes.push({ method, body: input });
        action = { ...action, ...input, version: action.version + 1 };
        actions = actions.map(item => item.id === id ? action : item); ticketVersion++;
      }
      body = { data: action, ticketVersion };
    } else return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
    await route.fulfill({ json: body });
  });
  await page.goto('/tickets/42');
  await expect(page.getByRole('heading', { name: 'Actions Taken' })).toBeVisible();
  await page.getByRole('button', { name: 'Add action', exact: true }).click();
  await page.getByLabel('Action description', { exact: false }).fill('Replace network adapter');
  await page.getByLabel('Assigned to', { exact: false }).selectOption('6');
  const description = page.getByLabel('Action description', { exact: false });
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByTestId('back-btn').click();
  await expect(description).toHaveValue('Replace network adapter');
  const viewport = page.viewportSize()!;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  await page.screenshot({ path: `artifacts/lab-04/screenshots/actions-taken/${testInfo.project.name}-mocked-create.png`, fullPage: true });
  await page.getByRole('button', { name: 'Save action', exact: true }).click();
  await expect(page.getByText('Action saved.', { exact: true })).toBeVisible();
  expect(writes[0].body).toMatchObject({ expectedTicketVersion: 8, assigneeId: 6, description: 'Replace network adapter', followUpRequired: false });
  expect(writes[0].body).not.toHaveProperty('performedById');
  expect(writes[0].key).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: 'Edit action 102', exact: true }).click();
  await page.getByRole('button', { name: 'Start action', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit action 102', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit action 102', exact: true }).click();
  await page.getByLabel('Result', { exact: false }).fill('Connectivity confirmed');
  await page.getByRole('button', { name: 'Complete action', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm complete action', exact: true }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit action 102', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit action 101', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel action', exact: true }).click();
  await page.getByLabel('Cancellation reason', { exact: false }).fill('Duplicate investigation');
  await page.getByRole('button', { name: 'Confirm cancel action', exact: true }).click();
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/lab-04/screenshots/actions-taken/${testInfo.project.name}-mocked-list.png`, fullPage: true });
  expect(writes.map(write => write.body.status).filter(Boolean)).toEqual(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
  expect(errors).toEqual([]);
});

import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}
async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('Lab 3 account, requester and staff UI works through the same-origin proxy', async ({ page }) => {
  test.setTimeout(120000);
  const email = `lab3-ui-${Date.now()}@example.com`;
  const password = 'Verified@Lab32026!';
  const summary = `UI verification ${Date.now()}`;

  await page.goto('/tickets/new');
  await expect(page).toHaveURL(/login\?redirectAfterLogin=/);
  await expect(page.getByText('Authentication coming in Lab 3')).toHaveCount(0);
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Sign In' }).click();
  await page.getByRole('link', { name: 'Need an account?' }).click();
  await expect(page.getByRole('heading', { name: 'Need an account?' })).toBeVisible();

  await signIn(page, 'admin@example.com', 'Admin@123!');
  await expect(page).toHaveURL(/admin\/users/);
  await page.getByLabel('Full name', { exact: true }).fill('Lab 3 UI Verification');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  const initialPassword = await page.locator('[role="status"] code').innerText();
  expect(initialPassword.length).toBeGreaterThan(20);
  await page.getByRole('button', { name: 'I copied it' }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/lab-03/screenshots/user-management/mobile.png', fullPage: true });
  await signOut(page);

  await page.goto('/tickets/new');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(initialPassword);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/change-password/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Change Your Password' })).toBeVisible();
  const blocked = await page.request.get('/api/tickets');
  expect(blocked.status()).toBe(403);
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/lab-03/screenshots/authentication/change-password.png', fullPage: true });
  await page.getByLabel('Current password', { exact: true }).fill(initialPassword);
  await page.getByLabel('New password', { exact: true }).fill(password);
  await page.getByLabel('Confirm new password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Save Password and Continue' }).click();
  await expect(page).toHaveURL(/tickets\/new$/);
  await page.getByTestId('summary-input').fill(summary);
  await page.getByTestId('description-input').fill('A ticket created with a real authenticated requester through the rebuilt client.');
  await page.getByTestId('submit-btn').click();
  await expect(page.getByTestId('success-panel')).toBeVisible();
  const listResponse = await page.request.get('/api/tickets?search=' + encodeURIComponent(summary));
  expect(listResponse.ok()).toBeTruthy();
  const ticket = (await listResponse.json()).data[0];
  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.getByTestId('ticket-summary')).toHaveText(summary);
  await page.getByLabel('New public comment').fill('The issue still needs support.');
  await page.getByRole('button', { name: 'Post Comment' }).click();
  await expect(page.getByText('Public comment posted.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Internal Notes' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Problem Appears Resolved', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Marked as resolved' })).toBeDisabled();
  await signOut(page);
  expect((await page.request.get(`/api/tickets/${ticket.id}`)).status()).toBe(401);

  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, 'michael.b@example.com', 'Staff@123!');
  await expect(page).toHaveURL(/queue$/);
  await page.getByLabel('Search queue').fill(summary);
  await page.getByRole('link', { name: ticket.ticketNumber, exact: true }).click();
  await expect(page.getByText('The issue still needs support.')).toBeVisible();
  await page.getByRole('button', { name: 'Assign to Me' }).click();
  await page.getByLabel('IT Priority', { exact: true }).selectOption('HIGH');
  await page.getByLabel('Current Status', { exact: true }).selectOption('OPEN');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByLabel('Current Status', { exact: true })).toHaveValue('OPEN');
  await page.getByLabel('New internal note').fill('Private verification note.');
  await page.getByRole('button', { name: 'Save Internal Note' }).click();
  await expect(page.getByText('Internal note saved.')).toBeVisible();
  await page.screenshot({ path: 'artifacts/lab-03/screenshots/staff-ticket-detail/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 900, height: 1024 });
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/lab-03/screenshots/staff-ticket-detail/tablet.png', fullPage: true });
  await page.goto('/queue');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByLabel('Search queue').fill(summary);
  await expect(page.getByRole('link', { name: ticket.ticketNumber, exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: 'artifacts/lab-03/screenshots/staff-queue/mobile.png', fullPage: true });
  await signOut(page);

  await signIn(page, email, password);
  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.getByText('Private verification note.')).toHaveCount(0);
  expect((await page.request.get(`/api/tickets/${ticket.id}/notes`)).status()).toBe(403);
  await signOut(page);
  await page.screenshot({ path: 'artifacts/lab-03/screenshots/authentication/mobile-login.png', fullPage: true });
});

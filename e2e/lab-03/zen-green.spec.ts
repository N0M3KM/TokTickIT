import { expect, test } from '@playwright/test';

// Isolated visual/UI checks: mocked authentication, not a database integration test.
test('Zen Green login and mandatory Change Password remain usable on desktop and mobile', async ({ page }) => {
  let signedIn = false;
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: signedIn ? 200 : 401,
    json: signedIn ? { id: 1, name: 'UI Test Requester', role: 'REQUESTER', mustChangePassword: true } : {},
  }));
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  await page.getByLabel('Email address').fill('ui@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Temporary@123');
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toHaveCSS('background-color', 'rgb(0, 107, 60)');
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveCSS('color', 'rgb(0, 107, 60)');
  await page.screenshot({ path: 'artifacts/lab-03/zen-green-login.png', fullPage: true });

  signedIn = true;
  await page.goto('/change-password');
  await expect(page.getByRole('heading', { name: 'Change Your Password' })).toBeVisible();
  await page.getByLabel('Current password', { exact: true }).fill('Temporary@123');
  await page.getByLabel('New password', { exact: true }).fill('Updated@456');
  await page.getByLabel('Confirm new password', { exact: true }).fill('Updated@456');
  const save = page.getByRole('button', { name: 'Save Password and Continue' });
  await expect(save).toBeEnabled();
  await expect(save).toHaveCSS('background-color', 'rgb(0, 107, 60)');
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/lab-03/zen-green-change-password.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(save).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/lab-03/zen-green-change-password-mobile.png', fullPage: true });
});

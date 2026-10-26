import { expect, test } from '@playwright/test';
import { HALEY, INTRUDER, signIn, signInAsHaley } from './helpers';

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key';
const DOC = 'http://127.0.0.1:8080/v1/projects/demo-good-dog/databases/(default)/documents/clients/c_maya';

test('wrong password shows a friendly error and no data', async ({ page }) => {
  await signIn(page, { email: HALEY.email, password: 'wrong-password' });
  await expect(page.getByRole('alert')).toContainText('don’t match an account');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('the database itself rejects an unauthorized account (server-side rules)', async ({ request }) => {
  const token = async (who: typeof HALEY) => (await (await request.post(AUTH, { data: { ...who, returnSecureToken: true } })).json()).idToken as string;
  const denied = await request.get(DOC, { headers: { Authorization: `Bearer ${await token(INTRUDER)}` } });
  expect(denied.status()).toBe(403);
  const anonymous = await request.get(DOC);
  expect(anonymous.status()).toBe(403);
  const allowed = await request.get(DOC, { headers: { Authorization: `Bearer ${await token(HALEY)}` } });
  expect(allowed.status()).toBe(200);
});

test('unauthorized account sees the No access screen and can sign out', async ({ page }) => {
  await signIn(page, INTRUDER);
  await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('keyboard: skip link, main navigation, and search palette', async ({ page }) => {
  await signInAsHaley(page);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();

  // Search palette: open with Ctrl+K, move with arrows, open with Enter, close with Escape.
  await page.keyboard.press('Control+k');
  const box = page.getByRole('combobox', { name: /Search/ });
  await expect(box).toBeFocused();
  await box.fill('ju');
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dogs\/d_juniper$/);

  await page.keyboard.press('Control+k');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox', { name: /Search/ })).toBeHidden();

  // Tabs on the dog profile follow the ARIA tabs pattern.
  await page.getByRole('tab', { name: 'Overview' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'true');
});

test('missing records show a not-found state instead of crashing', async ({ page }) => {
  await signInAsHaley(page);
  await page.goto('/dogs/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Dog not found' })).toBeVisible();
  await page.goto('/sessions/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Session not found' })).toBeVisible();
});

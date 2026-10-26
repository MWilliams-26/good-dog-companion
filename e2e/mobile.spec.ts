import { expect, test } from '@playwright/test';
import { signInAsHaley } from './helpers';

const pages = ['/', '/dogs', '/dogs/d_theo', '/clients', '/clients/c_renee', '/sessions', '/schedule', '/assessments/a_biscuit_initial', '/plans/p_juniper', '/settings'];

test('phone layout: five-tab bar and no sideways scrolling on key screens', async ({ page }) => {
  await signInAsHaley(page);
  const tabs = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
  await expect(tabs.getByRole('link')).toHaveText(['Home', 'Dogs', 'Clients', 'Sessions', 'Schedule']);
  for (const path of pages) {
    await page.goto(path);
    await expect(page.locator('main h1, main [role=status]').first()).toBeVisible();
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
});

test('phone: quick add sheet and session note entry', async ({ page }) => {
  await signInAsHaley(page);
  await page.getByRole('button', { name: 'New record' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add something new' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /Session notes/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Session notes' })).toBeVisible();
  await page.getByRole('radio', { name: 'Quick notes' }).check({ force: true });
  await expect(page.getByRole('textbox', { name: 'Notes' })).toBeVisible();
});

import { expect, type Page } from '@playwright/test';

export const HALEY = { email: 'haley@gooddog.demo', password: 'GoodDog!2026' };
export const INTRUDER = { email: 'intruder@example.demo', password: 'NotAllowed!2026' };

export async function signIn(page: Page, who = HALEY) {
  await page.goto('/');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signInAsHaley(page: Page) {
  await signIn(page);
  await expect(page.getByRole('heading', { level: 1, name: /Good (morning|afternoon|evening), Haley/ })).toBeVisible();
}

export const unique = (prefix: string) => `${prefix}${Date.now().toString(36).slice(-5)}`;

/** Fill a textbox inside an assessment question card. */
export const answer = (page: Page, qid: string) => page.locator(`#q-${qid}`);

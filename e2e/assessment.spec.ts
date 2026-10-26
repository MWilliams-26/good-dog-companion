import { expect, test } from '@playwright/test';
import { answer, signInAsHaley } from './helpers';

test('completed assessments keep a version history when reopened and edited', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await signInAsHaley(page);
  await page.goto('/assessments/a_sesame_initial');
  await expect(page.getByRole('heading', { level: 1, name: 'Initial assessment' })).toBeVisible();
  const original = 'Noticed a scooter at 80 feet, took food; at 30 feet he froze and could not disengage.';
  await expect(page.getByText(original)).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Dog & household' })).toBeVisible();
  await page.getByRole('button', { name: /^Consultant observations/ }).click();
  const box = answer(page, 'ob_observed').getByRole('textbox');
  await box.fill('Revised: disengaged from a bike at 45 feet after two sessions.');
  await page.getByRole('button', { name: 'Review & complete' }).click();
  await page.getByRole('button', { name: 'Complete assessment' }).click();

  await expect(page.getByText('Revised: disengaged from a bike at 45 feet')).toBeVisible();
  const versions = page.getByLabel('Version');
  // Current, plus a snapshot for each completion and for the reopen.
  await expect(versions.locator('option')).toHaveCount(4);
  const original1 = versions.locator('option', { hasText: 'Revision 1 · Completed' });
  await versions.selectOption({ label: (await original1.textContent())! });
  await expect(page.getByText('Viewing a historical version (read-only)')).toBeVisible();
  await expect(page.getByText(original)).toBeVisible();
});

test('Haley edits the template without code; new assessments use the new version, old ones keep theirs', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await signInAsHaley(page);
  await page.goto('/settings/template');
  const published = await page.getByText(/Published v\d+/).textContent();
  const current = Number(published!.match(/v(\d+)/)![1]);

  await page.getByRole('button', { name: /^Dog & household/ }).click();
  await page.getByRole('button', { name: 'Add question' }).click();
  await page.getByRole('button', { name: /New question/ }).last().click();
  const label = `Favorite walking route ${current + 1}`;
  await page.getByLabel('Question', { exact: true }).last().fill(label);
  await page.getByLabel('What changed in this version').fill('Added favorite route');
  await page.getByRole('button', { name: `Publish v${current + 1}` }).click();
  await expect(page.getByText(`Version ${current + 1} published`)).toBeVisible();

  // A new assessment uses the new version.
  await page.goto('/assessments/new?dog=d_olive&mode=initial');
  await expect(page.getByText(label)).toBeVisible();

  // An existing assessment still renders with v1.
  await page.goto('/assessments/a_juniper_initial');
  await expect(page.getByText(/template v1/)).toBeVisible();
});

test('“Not assessed” satisfies a required question and stale conditional answers are dropped', async ({ page }) => {
  await signInAsHaley(page);
  await page.goto('/assessments/a_biscuit_initial?section=safety');
  await answer(page, 'sf_bite_history').getByText('Yes', { exact: true }).click();
  await expect(answer(page, 'sf_incidents')).toBeVisible();
  await answer(page, 'sf_incidents').getByRole('textbox').fill('Placeholder');
  await answer(page, 'sf_bite_history').getByText('No', { exact: true }).click();
  await expect(page.locator('#q-sf_incidents')).toHaveCount(0);

  await page.getByRole('button', { name: 'Review & complete' }).click();
  await expect(page.getByRole('button', { name: /Safety & incidents → / })).toHaveCount(0);
  await page.getByRole('button', { name: /Dog & household → Typical daily routine/ }).click();
  await answer(page, 'hh_routine').getByRole('button', { name: 'Not assessed' }).click();
  await expect(answer(page, 'hh_routine').getByText('Marked not assessed')).toBeVisible();
  await page.getByRole('button', { name: 'Review & complete' }).click();
  await expect(page.getByRole('button', { name: /Typical daily routine/ })).toHaveCount(0);
});

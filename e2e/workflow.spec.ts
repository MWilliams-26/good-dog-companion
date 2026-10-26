import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { answer, INTRUDER, signIn, signInAsHaley, unique } from './helpers';

// The definition of done, end to end, on real (emulated) Firebase:
// sign in → client → dog → assessment → plan → follow-up session → goal progress
// → reminder → report → search → export → sign out → unauthorized user blocked.
test('Haley completes the full client workflow', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  const dogName = unique('Waffles');
  const lastName = unique('Testerson');
  const privateNote = `private-${unique('n')}`;
  const sessionWord = unique('lamppost');
  let dogUrl = '';

  await test.step('sign in', async () => {
    await signInAsHaley(page);
  });

  await test.step('create a client and their dog in one intake', async () => {
    await page.getByRole('link', { name: 'New client' }).first().click();
    await page.getByLabel('First name').fill('Robin');
    await page.getByLabel('Last name').fill(lastName);
    await page.getByLabel('Phone').fill('(555) 010-0199');
    await page.getByLabel('Email').fill('robin@example.com');
    await page.getByLabel('Neighborhood').fill('Ridgewood');
    await page.getByRole('textbox', { name: /^Name/ }).fill(dogName);
    await page.getByLabel('Breed or mix').fill('Boxer mix');
    await page.getByText('Reactivity', { exact: true }).click();
    await page.getByRole('button', { name: 'Create client' }).click();
    await expect(page.getByRole('heading', { level: 1, name: dogName })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(`Robin ${lastName}`) }).first()).toBeVisible();
    dogUrl = new URL(page.url()).pathname;
  });

  await test.step('complete an initial behavioral assessment', async () => {
    await page.getByRole('link', { name: 'Start assessment' }).click();
    await expect(page.getByRole('heading', { name: 'Dog & household' })).toBeVisible();

    // Conditional question appears only after choosing "Rescue or shelter".
    await expect(page.getByText('What is known about the rescue or shelter history?')).toHaveCount(0);
    await answer(page, 'hh_acquired_from').getByText('Rescue or shelter').click();
    await expect(page.getByText('What is known about the rescue or shelter history?')).toBeVisible();
    await answer(page, 'hh_rescue_history').getByRole('textbox').fill('Transported from upstate, one prior return.');
    await answer(page, 'hh_members').getByRole('textbox').first().fill('Robin');
    await answer(page, 'hh_routine').getByRole('textbox').fill('Morning walk, works from home, evening walk.');

    // Autosave survives a refresh.
    await expect(page.locator('[data-save-state="saved"]')).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(answer(page, 'hh_routine').getByRole('textbox')).toHaveValue('Morning walk, works from home, evening walk.');
    await expect(answer(page, 'hh_rescue_history').getByRole('textbox')).toHaveValue('Transported from upstate, one prior return.');

    await page.getByRole('button', { name: /^Primary concerns/ }).click();
    await answer(page, 'co_reason').getByRole('textbox').fill('Barks and lunges at dogs on walks.');
    await answer(page, 'co_main_concerns').getByText('Reactivity', { exact: true }).click();
    await answer(page, 'co_description').getByRole('textbox').fill('Stiffens, stares, lunges at dogs within 30 feet.');
    await answer(page, 'co_goals').getByRole('textbox').fill('Walk the block calmly.');

    // The dog's Reactivity tag turned that module on; a newly selected concern suggests another.
    await expect(page.getByRole('button', { name: /^Reactivity/ })).toBeVisible();
    await answer(page, 'co_main_concerns').getByText('Resource guarding', { exact: true }).click();
    await page.getByRole('button', { name: /^Modules/ }).click();
    await expect(page.getByRole('checkbox', { name: /Reactivity/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Resource guarding.*Suggested/ })).not.toBeChecked();
    await page.getByRole('checkbox', { name: /Resource guarding/ }).check();
    await expect(page.getByRole('button', { name: /^Resource guarding/ })).toBeVisible();

    await page.getByRole('button', { name: /^Safety & incidents/ }).click();
    await answer(page, 'sf_bite_history').getByText('No', { exact: true }).click();
    await expect(page.locator('#q-sf_incidents')).toHaveCount(0);

    await page.getByRole('button', { name: /^Consultant observations/ }).click();
    await answer(page, 'ob_observed').getByRole('textbox').fill('Took food at 60 ft; over threshold at 25 ft.');

    await page.getByRole('button', { name: /^Recommendations/ }).click();
    await answer(page, 'rc_management').getByRole('textbox').fill('Quiet routes and early U-turns.');
    const goals = answer(page, 'rc_goals').getByRole('textbox');
    await goals.first().fill('Notice dogs and re-engage');
    await goals.first().press('Enter');
    await goals.nth(1).fill('Loose leash on the block');
    await answer(page, 'rc_success').getByRole('textbox').first().fill('Takes food with a dog across the street');

    await page.getByRole('button', { name: 'Review & complete' }).click();
    await expect(page.getByText('Every required question is answered.')).toBeVisible();
    await page.getByRole('button', { name: 'Complete assessment' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Initial assessment' })).toBeVisible();
    await expect(page.getByText('Took food at 60 ft; over threshold at 25 ft.')).toBeVisible();
  });

  await test.step('create a training plan from the assessment recommendations', async () => {
    await page.goto(dogUrl);
    await page.getByRole('link', { name: 'New training plan' }).click();
    await expect(page.getByText(/Start with the goals from the/)).toBeVisible();
    await page.getByRole('button', { name: 'Create plan' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Notice dogs and re-engage' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Loose leash on the block' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit Notice dogs and re-engage' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit goal' });
    await dialog.getByLabel('Milestone 1').fill('Takes food at 50 ft');
    await dialog.getByRole('button', { name: 'Save goal' }).click();
    await expect(page.getByRole('button', { name: /Takes food at 50 ft/ })).toBeVisible();
  });

  await test.step('record a follow-up consultation with goal progress and a reminder', async () => {
    await page.goto(dogUrl);
    await page.getByRole('link', { name: 'Session notes' }).click();
    await page.getByRole('textbox', { name: 'What you observed today' }).fill(`Calm past the ${sessionWord} at 40 ft.`);
    await page.getByRole('textbox', { name: 'Client homework' }).fill('Engage–Disengage 5 minutes a day.');
    await page.getByRole('textbox', { name: /Consultant-only notes/ }).fill(privateNote);
    await page.getByRole('checkbox', { name: 'Notice dogs and re-engage' }).check();
    await page.getByLabel('Progress observation for Notice dogs and re-engage').fill('Re-engaged 4 of 5 times at 40 ft.');
    await page.getByLabel('Milestone reached').selectOption({ label: 'Reached: Takes food at 50 ft' });
    await expect(page.getByRole('checkbox', { name: /Set a follow-up reminder/ })).toBeChecked();
    await page.getByLabel('Reminder', { exact: true }).fill(`Check ${dogName}'s homework`);
    await page.getByRole('button', { name: 'Save session' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Follow-up' })).toBeVisible();
    await expect(page.getByText('Re-engaged 4 of 5 times at 40 ft.')).toBeVisible();
    await expect(page.getByText(`Check ${dogName}'s homework`)).toBeVisible();
  });

  await test.step('update goal progress on the plan', async () => {
    await page.getByRole('link', { name: 'Open training plan' }).click();
    await expect(page.getByText(/Reached .*/).first()).toBeVisible();
    await page.getByLabel('Status of Notice dogs and re-engage').selectOption('maintaining');
    await expect(page.getByText('Goal status updated')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Status of Notice dogs and re-engage')).toHaveValue('maintaining');
  });

  await test.step('schedule a follow-up reminder and an appointment', async () => {
    await page.goto('/schedule?followup=new');
    const dialog = page.getByRole('dialog', { name: 'New follow-up' });
    await dialog.getByLabel('Reminder').fill(`Email ${lastName} the handout`);
    await dialog.getByLabel('Dog').selectOption({ label: dogName });
    await dialog.getByRole('button', { name: 'Add follow-up' }).click();
    await expect(page.getByText(`Email ${lastName} the handout`)).toBeVisible();

    await page.getByRole('link', { name: 'Appointment' }).click();
    await page.locator('label').filter({ hasText: dogName }).click();
    await page.getByLabel('Time').fill('15:30');
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(page.getByText('Appointment scheduled')).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(dogName) }).first()).toBeVisible();
  });

  await test.step('generate a client-ready report that keeps private notes out', async () => {
    await page.goto('/sessions');
    await page.getByRole('link', { name: new RegExp(dogName) }).first().click();
    await page.getByRole('button', { name: 'Client summary' }).click();
    const preview = page.getByRole('article', { name: 'Report preview' });
    await expect(preview.getByText('Engage–Disengage 5 minutes a day.')).toBeVisible();
    await expect(preview).not.toContainText(privateNote);
    await expect(page.getByRole('button', { name: 'Include “Consultant notes”' })).toBeVisible();

    // Opting in shows it; opting out hides it again.
    await page.getByRole('button', { name: 'Include “Consultant notes”' }).click();
    await expect(preview).toContainText(privateNote);
    await page.getByRole('button', { name: 'Exclude “Consultant notes”' }).click();
    await expect(preview).not.toContainText(privateNote);

    await page.getByLabel('Prepared for').fill(`Robin ${lastName}`);
    await page.getByRole('button', { name: 'Mark final' }).click();
    await expect(page.getByText('Final', { exact: true })).toBeVisible();
    const pdf = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDF' }).click();
    expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  });

  await test.step('search finds the dog and the session notes', async () => {
    await page.keyboard.press('Control+k');
    const box = page.getByRole('combobox', { name: /Search/ });
    await box.fill(dogName);
    await expect(page.getByRole('option', { name: new RegExp(`^${dogName}`) })).toHaveAttribute('aria-selected', 'true');
    await box.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: dogName })).toBeVisible();
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByRole('link', { name: 'Initial assessment' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Training plan started/ })).toBeVisible();

    await page.goto(`/search?q=${sessionWord}`);
    await expect(page.getByText(/1 result/)).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(`${dogName} · Follow-up`) })).toBeVisible();
  });

  await test.step('export records', async () => {
    await page.goto('/settings');
    const json = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download complete backup/ }).click();
    const backup = JSON.parse(readFileSync(await (await json).path(), 'utf8'));
    expect(backup.collections.dogs.some((d: { name: string }) => d.name === dogName)).toBe(true);
    expect(backup.collections.assessmentRevisions.length).toBeGreaterThan(0);
    expect(backup.counts.consultations).toBeGreaterThan(0);

    const csv = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Dogs CSV' }).click();
    const text = readFileSync(await (await csv).path(), 'utf8');
    expect(text.split('\r\n')[0]).toContain('Name,Breed');
    expect(text).toContain(dogName);
    expect(text).not.toContain('Safety notes');
  });

  await test.step('sign out, then an unauthorized account cannot see anything', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    // Sign-out clears the offline cache, then reloads at /.
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.goto('/dogs');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByText(dogName)).toHaveCount(0);

    await signIn(page, INTRUDER);
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible();
    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible();
    await expect(page.getByText(lastName)).toHaveCount(0);
  });
});

import { test, expect, type Page } from '@playwright/test';

const MAILPIT = 'http://127.0.0.1:54324';

async function fetchOtp(page: Page, recipient: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await page.request.get(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`,
    );
    if (list.ok()) {
      const body = (await list.json()) as { messages?: { ID: string }[] };
      const msg = body.messages?.[0];
      if (msg) {
        const detail = await page.request.get(
          `${MAILPIT}/api/v1/message/${msg.ID}`,
        );
        const text = JSON.stringify(await detail.json());
        const match = text.match(/\b(\d{6})\b/);
        if (match) return match[1];
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`No OTP email arrived for ${recipient}`);
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/auth/sign-in');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  const code = await fetchOtp(page, email);
  await page.getByPlaceholder('123456').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app');
}

test('open Hypothesis → search literature → attach → Reference appears', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `lit_${Date.now()}@lab.test`;
  await signIn(page, email);

  // Set up a Project + Hypothesis.
  await page.goto('/app');
  const projectTitle = `Lit ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByRole('button', { name: 'Create Project' }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();

  await page.getByLabel('Hypothesis statement').fill('CRISPR increases yield');
  await page.getByRole('button', { name: 'Add Hypothesis' }).click();
  await expect(page.getByText('CRISPR increases yield')).toBeVisible();

  // Search literature from the Hypothesis.
  const refsPanel = page.getByTestId('hypothesis-references').first();
  await refsPanel.getByLabel('Literature search query').fill('CRISPR yield');
  await refsPanel.getByRole('button', { name: 'Search' }).click();

  const results = refsPanel.getByTestId('literature-results');
  await expect(results).toBeVisible();

  // Attach the first result.
  await results
    .getByRole('button', { name: 'Attach' })
    .first()
    .click();

  // The Reference now appears under the Hypothesis with a source link.
  const refList = refsPanel.getByTestId('reference-list');
  await expect(refList).toBeVisible();
  await expect(refList.getByRole('link', { name: 'Source' }).first()).toBeVisible();

  // Persists across reload.
  await page.reload();
  await expect(
    page.getByTestId('reference-list').first(),
  ).toBeVisible();
});

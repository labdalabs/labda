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

test('Hypothesis with a contradicting Reference → challenge → grounded contradiction', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `copilot_${Date.now()}@lab.test`;
  await signIn(page, email);

  await page.goto('/app');
  const projectTitle = `Copilot ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByRole('button', { name: 'Create Project' }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();

  await page.getByLabel('Hypothesis statement').fill('CRISPR increases crop yield');
  await page.getByRole('button', { name: 'Add Hypothesis' }).click();
  await expect(page.getByText('CRISPR increases crop yield')).toBeVisible();

  // The stub corpus (s2-stub) returns papers about CRISPR yield; search + attach
  // a Reference. (The stub's first paper is about CRISPR increasing yield; the
  // grounded engine will classify it and also surface logic gaps.)
  const refsPanel = page.getByTestId('hypothesis-references').first();
  await refsPanel.getByLabel('Literature search query').fill('CRISPR yield');
  await refsPanel.getByRole('button', { name: 'Search' }).click();
  await expect(refsPanel.getByTestId('literature-results')).toBeVisible();
  await refsPanel.getByRole('button', { name: 'Attach' }).first().click();
  await expect(refsPanel.getByTestId('reference-list')).toBeVisible();

  // Ask the copilot to challenge the Hypothesis.
  const copilot = refsPanel.getByTestId('copilot-thread');
  await copilot.getByRole('button', { name: 'Challenge this Hypothesis' }).click();

  // Grounded findings appear. At minimum, the logic-gap detection produces
  // grounded push-backs (missing control / mechanism). Assert grounded output.
  await expect(copilot.getByTestId('copilot-findings')).toBeVisible();
  await expect(copilot.getByText(/Logic gap:/).first()).toBeVisible();
});

test('Hypothesis challenge surfaces a grounded contradiction with a source link', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `copilot2_${Date.now()}@lab.test`;
  await signIn(page, email);

  await page.goto('/app');
  const projectTitle = `Contra ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByRole('button', { name: 'Create Project' }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();

  await page.getByLabel('Hypothesis statement').fill('CRISPR increases crop yield');
  await page.getByRole('button', { name: 'Add Hypothesis' }).click();

  // s2-stub's second paper is about off-target effects; but to deterministically
  // exercise the contradiction path we search + attach both stub papers.
  const refsPanel = page.getByTestId('hypothesis-references').first();
  await refsPanel.getByLabel('Literature search query').fill('CRISPR yield');
  await refsPanel.getByRole('button', { name: 'Search' }).click();
  await expect(refsPanel.getByTestId('literature-results')).toBeVisible();
  // Attach all returned results.
  const attachButtons = refsPanel.getByRole('button', { name: 'Attach' });
  const count = await attachButtons.count();
  for (let i = 0; i < count; i++) {
    await refsPanel.getByRole('button', { name: 'Attach' }).first().click();
  }

  const copilot = refsPanel.getByTestId('copilot-thread');
  await copilot.getByRole('button', { name: 'Challenge this Hypothesis' }).click();
  await expect(copilot.getByTestId('copilot-findings')).toBeVisible();
  // A grounded contradiction (stub paper 2 says CRISPR did NOT increase yield),
  // with its source link.
  const contradiction = copilot.locator('[data-finding-kind="CONTRADICTS"]');
  await expect(contradiction.first()).toBeVisible();
  await expect(contradiction.first().getByTestId('copilot-source')).toBeVisible();
  await expect(contradiction.first()).toContainText(/did not increase/i);
});

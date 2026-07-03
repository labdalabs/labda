import { test, expect, type Page } from '@playwright/test';

// Mailpit (Supabase local email sink) REST API.
const MAILPIT = 'http://127.0.0.1:54324';

// Poll Mailpit for the newest message to `recipient` and extract the 6-digit
// Supabase OTP code from its body.
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
  // The sign-in flow lands on '/'; wait for it to settle.
  await page.waitForURL('**/app');
}

test('sign in → create Project → add Hypothesis → see it listed', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `e2e_${Date.now()}@lab.test`;

  await signIn(page, email);

  // Open the research workspace.
  await page.goto('/app');
  await expect(
    page.getByRole('heading', { name: 'Projects', exact: true }),
  ).toBeVisible();

  // Create a Project.
  const projectTitle = `Study ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByLabel('Project description').fill('An e2e research project');
  await page.getByRole('button', { name: 'Create Project' }).click();

  // It appears in the list.
  const projectLink = page.getByRole('link', { name: new RegExp(projectTitle) });
  await expect(projectLink).toBeVisible();

  // Open it and add a Hypothesis via the graph composer (the single create
  // surface — the overview form was retired).
  await projectLink.click();
  await page.getByTestId('open-graph').click();
  await expect(page.getByTestId('knowledge-canvas')).toBeVisible();
  await page.getByTestId('add-node-toggle').click();
  const composer = page.getByTestId('node-composer');
  await composer.getByRole('button', { name: 'Hypothesis', exact: true }).click();
  const statement = 'Compound X inhibits enzyme Y';
  await composer.getByLabel('Node title').fill(statement);
  await composer.getByRole('button', { name: 'Add' }).click();

  // The Hypothesis appears in the project.
  await expect(
    page.getByTestId('tray-node').filter({ hasText: statement }),
  ).toBeVisible();

  // Persists across reload (reopen the board tab).
  await page.reload();
  await page.getByTestId('open-graph').click();
  await expect(
    page.getByTestId('tray-node').filter({ hasText: statement }),
  ).toBeVisible();
});

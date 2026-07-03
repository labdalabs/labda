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
        const m = JSON.stringify(await detail.json()).match(/\b(\d{6})\b/);
        if (m) return m[1];
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`No OTP for ${recipient}`);
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/auth/sign-in');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByPlaceholder('123456').fill(await fetchOtp(page, email));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app');
}

// The VS Code-style workspace: Work home, agent sessions, the OKF file explorer,
// and multiple open tabs.
test('workspace: work home, sessions, files, and tabs', async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, `ws_${Date.now()}@lab.test`);

  await page.goto('/app');
  const title = `Workspace ${Date.now()}`;
  await page.getByLabel('Project title').fill(title);
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: new RegExp(title) }).click();

  // Lands on the Work view.
  await expect(page.getByTestId('project-home')).toBeVisible();

  // Start an agent session — opens a session tab.
  await page.getByLabel('Session goal').fill('Design an assay');
  await page.getByTestId('start-session').click();
  await expect(
    page.locator('[data-testid="tab"]').filter({ hasText: 'Design an assay' }),
  ).toBeVisible();

  // Open the board and author a node.
  await page.getByTestId('open-graph').click();
  await expect(page.getByTestId('knowledge-canvas')).toBeVisible();
  await page.getByTestId('add-node-toggle').click();
  const composer = page.getByTestId('node-composer');
  await composer.getByRole('button', { name: 'Idea', exact: true }).click();
  await composer.getByLabel('Node title').fill('Membrane assay');
  await composer.getByRole('button', { name: 'Add' }).click();
  await expect(
    page.getByTestId('tray-node').filter({ hasText: 'Membrane assay' }),
  ).toBeVisible();

  // The node shows up in the sidebar OKF file explorer; open it → a file tab.
  const fileRow = page.getByRole('button', { name: /membrane-assay\.md/ });
  await expect(fileRow).toBeVisible();
  await fileRow.click();
  await expect(page.getByTestId('okf-file')).toBeVisible();

  // Four tabs open now: Work, the session, Knowledge, the file.
  await expect(page.locator('[data-testid="tab"]')).toHaveCount(4);

  // Close the session tab.
  await page
    .locator('[data-testid="tab"]')
    .filter({ hasText: 'Design an assay' })
    .getByRole('button', { name: 'Close tab' })
    .click();
  await expect(page.locator('[data-testid="tab"]')).toHaveCount(3);
});

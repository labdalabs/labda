import { test, expect, type Page } from '@playwright/test';

// Verifies the remote Jupyter kernel path (ADR-0027) end to end in the browser
// against a REAL Jupyter server. Skipped unless a server is provided, since it
// needs one running:
//
//   JUPYTER_URL=http://127.0.0.1:8888 JUPYTER_TOKEN=<token> \
//     pnpm exec playwright test kernel-jupyter.spec.ts --project=chromium
//
// (Start one with: `jupyter kernelgateway --KernelGatewayApp.allow_origin='*'`.)

const JUPYTER_URL = process.env.JUPYTER_URL;
const JUPYTER_TOKEN = process.env.JUPYTER_TOKEN ?? '';
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
        const m = text.match(/\b(\d{6})\b/);
        if (m) return m[1];
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

test('run a cell against a real remote Jupyter kernel', async ({ page }) => {
  test.skip(!JUPYTER_URL, 'Set JUPYTER_URL to run against a real Jupyter server');
  test.setTimeout(120_000);
  const email = `jup_${Date.now()}@lab.test`;
  await signIn(page, email);

  await page.goto('/app');
  const projectTitle = `Jup ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByRole('button', { name: 'Create Project' }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();
  await page
    .getByTestId('protocols-panel')
    .getByLabel('Protocol title')
    .fill('Remote');
  await page
    .getByTestId('protocols-panel')
    .getByRole('button', { name: 'Create Protocol' })
    .click();
  await expect(page.getByTestId('cell-list')).toBeVisible();

  // Select the remote Jupyter kernel.
  await page.getByTestId('kernel-mode').selectOption('jupyter');
  await page.getByLabel('Jupyter server URL').fill(JUPYTER_URL as string);
  if (JUPYTER_TOKEN) await page.getByLabel('Jupyter token').fill(JUPYTER_TOKEN);

  await page.getByRole('button', { name: '+ Code' }).click();
  await page.getByLabel('code cell 2').fill('print(6 * 7)');
  await page.getByTestId('run-cell').first().click();

  await expect(page.getByTestId('kernel-status')).toHaveText(/ready/, {
    timeout: 60_000,
  });
  await expect(page.getByTestId('cell-outputs').first()).toContainText('42', {
    timeout: 30_000,
  });
});

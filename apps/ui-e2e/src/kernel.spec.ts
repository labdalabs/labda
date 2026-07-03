import { test, expect, type Page } from '@playwright/test';
import { createProtocolAndOpen } from './support/graph';

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

test('open a Protocol → run a cell → see output; outputs persist', async ({
  page,
}) => {
  // Pyodide downloads a ~10MB WASM runtime from the CDN on first run.
  test.setTimeout(240_000);
  const email = `kernel_${Date.now()}@lab.test`;
  await signIn(page, email);

  await page.goto('/app');
  const projectTitle = `Kernel ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByRole('button', { name: 'Create Project' }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();

  await createProtocolAndOpen(page, 'Compute v1');

  // Add a code cell and run a computation + assign a variable.
  await page.getByRole('button', { name: '+ Code' }).click();
  await page.getByLabel('code cell 2').fill('answer = 6 * 7\nprint(answer)');
  await page.getByTestId('run-cell').first().click();

  // Kernel becomes ready and the output (42) streams into the cell.
  await expect(page.getByTestId('kernel-status')).toHaveText(/ready/, {
    timeout: 180_000,
  });
  const outputs = page.getByTestId('cell-outputs').first();
  await expect(outputs).toContainText('42', { timeout: 60_000 });

  // Variable inspector reflects the kernel state.
  await expect(page.getByTestId('variable-inspector')).toContainText('answer');

  // Save, reopen — the outputs persist with the notebook.
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Saved \(v2\)/)).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('cell-outputs').first()).toContainText('42');
});

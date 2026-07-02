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
  await page.waitForURL('**/');
}

test('create Protocol → edit a cell → save → reopen shows the change', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `proto_${Date.now()}@lab.test`;
  await signIn(page, email);

  // Set up a Project.
  await page.goto('/app');
  const projectTitle = `Proto ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByRole('button', { name: 'Create Project' }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();

  // Create a Protocol (navigates into the notebook editor).
  await page
    .getByTestId('protocols-panel')
    .getByLabel('Protocol title')
    .fill('Assay v1');
  await page
    .getByTestId('protocols-panel')
    .getByRole('button', { name: 'Create Protocol' })
    .click();

  // Editor opens with the starter markdown cell.
  await expect(page.getByTestId('cell-list')).toBeVisible();
  await expect(page.getByTestId('notebook-cell')).toHaveCount(1);

  // Add a code cell and edit it.
  await page.getByRole('button', { name: '+ Code' }).click();
  const codeCell = page.getByLabel('code cell 2');
  const marker = `print('cell-${Date.now()}')`;
  await codeCell.fill(marker);

  // Save.
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Saved \(v2\)/)).toBeVisible();

  // Reopen (reload) shows the edited cell content persisted.
  await page.reload();
  await expect(page.getByTestId('cell-list')).toBeVisible();
  await expect(page.getByLabel('code cell 2')).toHaveValue(marker);
});

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

test('run an analysis on sample output → export → download a valid xlsx', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `analysis_${Date.now()}@lab.test`;
  await signIn(page, email);

  await page.goto('/app');
  const projectTitle = `Analysis ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByRole('button', { name: 'Create Project' }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();

  await page
    .getByTestId('protocols-panel')
    .getByLabel('Protocol title')
    .fill('Assay');
  await page
    .getByTestId('protocols-panel')
    .getByRole('button', { name: 'Create Protocol' })
    .click();

  // The Analysis panel is on the notebook editor page.
  const panel = page.getByTestId('analysis-panel');
  await expect(panel).toBeVisible();

  // Use the sample dataset and run the analysis.
  await panel.getByRole('button', { name: 'Use sample data' }).click();
  await panel.getByRole('button', { name: 'Run Analysis' }).click();

  // Stats + chart appear.
  await expect(panel.getByTestId('analysis-stats')).toBeVisible();
  await expect(panel.getByTestId('analysis-chart')).toBeVisible();

  // Export to Excel → a download link appears.
  await panel.getByRole('button', { name: 'Export to Excel' }).click();
  const link = panel.getByTestId('download-xlsx');
  await expect(link).toBeVisible();

  // Fetch the signed URL and assert it is a valid xlsx (ZIP/OOXML).
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  const res = await page.request.get(href as string);
  expect(res.ok()).toBeTruthy();
  const body = await res.body();
  expect(body.length).toBeGreaterThan(2000);
  // xlsx is a ZIP: first two bytes are 'PK'.
  expect(body.subarray(0, 2).toString('latin1')).toBe('PK');
});

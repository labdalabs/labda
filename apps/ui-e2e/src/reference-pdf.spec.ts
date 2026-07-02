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
  await page.waitForURL('**/');
}

test('attach an open-access paper → download a valid PDF', async ({ page }) => {
  test.setTimeout(120_000);
  const email = `pdf_${Date.now()}@lab.test`;
  await signIn(page, email);

  await page.goto('/app');
  const projectTitle = `Pdf ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByRole('button', { name: 'Create Project' }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();
  await page.getByLabel('Hypothesis statement').fill('CRISPR increases yield');
  await page.getByRole('button', { name: 'Add Hypothesis' }).click();
  await expect(page.getByText('CRISPR increases yield')).toBeVisible();

  const panel = page.getByTestId('hypothesis-references').first();
  await panel.getByLabel('Literature search query').fill('CRISPR yield');
  await panel.getByRole('button', { name: 'Search' }).click();
  await expect(panel.getByTestId('literature-results')).toBeVisible();
  // Attach the first result (stub-paper-1 has an open-access PDF).
  await panel.getByRole('button', { name: 'Attach' }).first().click();
  await expect(panel.getByTestId('reference-list')).toBeVisible();

  // A Download PDF action appears for the open-access Reference.
  const download = panel.getByTestId('download-pdf').first();
  await expect(download).toBeVisible();

  // Clicking it caches the OA PDF and returns a signed URL. Read the URL from
  // the GraphQL response (robust vs. popup timing).
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes('/graphql') &&
        (r.request().postData() ?? '').includes('DownloadReferencePdf'),
    ),
    download.click(),
  ]);
  const json = (await resp.json()) as {
    data: { downloadReferencePdf: { url: string } };
  };
  const pdfUrl = json.data.downloadReferencePdf.url;

  // Fetch the signed URL and assert it is a valid PDF.
  const res = await page.request.get(pdfUrl);
  expect(res.ok()).toBeTruthy();
  const body = await res.body();
  expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
});

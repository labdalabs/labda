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

// The EVE frontend integration: the assistant-ui runtime (`useEveAgentRuntime`)
// talks to same-origin /eve/v1/*, which the UI route handler proxies to the
// agent, and renders the streamed reply. Runs against the EVE stub (a live
// agent needs a model credential).
test('research agent chat streams a reply via the EVE proxy', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `eve_${Date.now()}@lab.test`;
  await signIn(page, email);

  await page.goto('/app');
  const projectTitle = `Eve ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByRole('button', { name: 'Create Project' }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();

  await page.getByTestId('open-assistant').click();
  await expect(page.getByTestId('eve-chat')).toBeVisible();

  // The assistant-ui composer is a textarea; Enter submits the turn.
  const composer = page.getByPlaceholder(/Message the research agent/);
  await composer.fill('Challenge my hypothesis');
  await composer.press('Enter');

  // The streamed assistant reply (from the stub), rendered as markdown.
  await expect(
    page.getByText('one Reference contradicts it', { exact: false }),
  ).toBeVisible();
});

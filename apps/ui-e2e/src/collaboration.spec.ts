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

// Two researchers, one shared project: B sees the project A shared, and while
// both view its graph, B sees A's live presence focused on a node.
test('share a project and see a collaborator focus a node', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const emailA = `collab_a_${stamp}@lab.test`;
  const emailB = `collab_b_${stamp}@lab.test`;

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();

  // B signs in first so their Profile exists for the email lookup.
  await signIn(B, emailB);

  // A creates a project + hypothesis, then shares it with B.
  await signIn(A, emailA);
  await A.goto('/app');
  const title = `Collab ${stamp}`;
  await A.getByLabel('Project title').fill(title);
  await A.getByRole('button', { name: 'Create project' }).click();
  await A.getByRole('link', { name: new RegExp(title) }).click();
  await A.getByLabel('Hypothesis statement').fill('Shared hypothesis');
  await A.getByRole('button', { name: 'Add Hypothesis' }).click();
  await A.getByText('Shared hypothesis').waitFor();

  const share = A.getByTestId('share-panel');
  await share.getByLabel('Collaborator email').fill(emailB);
  await share.getByRole('button', { name: 'Share' }).click();
  await expect(A.getByTestId('member-list')).toContainText(emailB);

  // A opens the board and places the hypothesis cell.
  await A.getByTestId('open-graph').click();
  await expect(A.getByTestId('knowledge-canvas')).toBeVisible();
  await A.getByTestId('tray-node')
    .filter({ hasText: 'Shared hypothesis' })
    .dragTo(A.getByTestId('hex-drop').first());
  const aCell = A.locator(
    '[data-testid="graph-node"][data-node-type="Hypothesis"]',
  );
  await expect(aCell).toHaveCount(1);
  await aCell.click(); // A focuses the cell

  // B sees the shared project, opens the board — the placed cell is there.
  await B.goto('/app');
  await B.getByRole('link', { name: new RegExp(title) }).click();
  await B.getByTestId('open-graph').click();
  await expect(
    B.locator('[data-testid="graph-node"][data-node-type="Hypothesis"]'),
  ).toHaveCount(1);

  // B sees A present and focused on that cell (live via Realtime).
  await expect(B.getByTestId('presence-strip')).toBeVisible({ timeout: 25_000 });
  await expect(B.getByTestId('node-presence').first()).toBeVisible({
    timeout: 25_000,
  });

  await ctxA.close();
  await ctxB.close();
});

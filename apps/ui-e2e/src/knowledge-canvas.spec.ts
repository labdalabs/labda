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

// The hex knowledge board: author a node, drag it onto the grid to place it,
// then open its detail panel and edit it.
test('knowledge board: author, place, and inspect a node', async ({ page }) => {
  test.setTimeout(120_000);
  const email = `board_${Date.now()}@lab.test`;
  await signIn(page, email);

  await page.goto('/app');
  const projectTitle = `Board ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();

  await page.getByLabel('Hypothesis statement').fill('CRISPR increases yield');
  await page.getByRole('button', { name: 'Add Hypothesis' }).click();
  await expect(page.getByText('CRISPR increases yield')).toBeVisible();

  // Open the knowledge board.
  await page.getByTestId('open-graph').click();
  await expect(page.getByTestId('knowledge-canvas')).toBeVisible();

  // Author a node — it lands in the tray of unplaced nodes.
  await page.getByTestId('add-node-toggle').click();
  const composer = page.getByTestId('node-composer');
  await composer.getByRole('button', { name: 'Observation' }).click();
  await composer.getByLabel('Node title').fill('Cells cluster under stress');
  await composer.getByRole('button', { name: 'Add' }).click();
  const trayNode = page
    .getByTestId('tray-node')
    .filter({ hasText: 'Cells cluster under stress' });
  await expect(trayNode).toBeVisible();

  // Drag it onto the board (the seed drop zone) — it becomes a placed cell.
  await trayNode.dragTo(page.getByTestId('hex-drop').first());
  const placed = page.locator(
    '[data-testid="graph-node"][data-node-type="Observation"]',
  );
  await expect(placed).toHaveCount(1);

  // Click the cell → the right-side detail panel with its title.
  await placed.click();
  const panel = page.getByTestId('node-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Cells cluster under stress');

  // Placement persists across a reload.
  await page.reload();
  await expect(
    page.locator('[data-testid="graph-node"][data-node-type="Observation"]'),
  ).toHaveCount(1);
});

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

test('knowledge canvas renders the graph, opens entities, links nodes, persists', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = `graph_${Date.now()}@lab.test`;
  await signIn(page, email);

  await page.goto('/app');
  const projectTitle = `Graph ${Date.now()}`;
  await page.getByLabel('Project title').fill(projectTitle);
  await page.getByRole('button', { name: 'Create Project' }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();

  // Add a Hypothesis and a Protocol so the graph has several node types.
  await page.getByLabel('Hypothesis statement').fill('CRISPR increases yield');
  await page.getByRole('button', { name: 'Add Hypothesis' }).click();
  await expect(page.getByText('CRISPR increases yield')).toBeVisible();
  await page
    .getByTestId('protocols-panel')
    .getByLabel('Protocol title')
    .fill('Assay');
  // Creating a Protocol navigates to the editor; go back to the project after.
  await page
    .getByTestId('protocols-panel')
    .getByRole('button', { name: 'Create Protocol' })
    .click();
  await page.getByRole('link', { name: 'Back to Project' }).click();

  // Open the knowledge graph canvas.
  await page.getByTestId('open-graph').click();
  await expect(page.getByTestId('knowledge-canvas')).toBeVisible();

  // The Project is a container, not a node; its entities render as nodes.
  await expect(
    page.locator('[data-testid="graph-node"][data-node-type="Project"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-testid="graph-node"][data-node-type="Hypothesis"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-testid="graph-node"][data-node-type="Protocol"]'),
  ).toHaveCount(1);

  // Author a new markdown node of a chosen type; it joins the graph.
  await page.getByTestId('add-node-toggle').click();
  const composer = page.getByTestId('node-composer');
  await composer.getByRole('button', { name: 'Observation' }).click();
  await composer.getByLabel('Node title').fill('Cells cluster under stress');
  await composer
    .getByLabel('Node content')
    .fill('At 43°C, cells aggregate near the nucleus.');
  // Import a source file (uploaded browser-direct to private Storage).
  await composer.getByLabel('Source file').setInputFiles({
    name: 'viability.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('temp,viability\n30,0.98\n45,0.12'),
  });
  await expect(composer.getByTestId('source-file-name')).toContainText(
    'viability.csv',
  );
  await composer.getByRole('button', { name: 'Add node' }).click();
  await expect(
    page.locator('[data-testid="graph-node"][data-node-type="Observation"]'),
  ).toHaveCount(1);

  // Focusing the authored node shows its markdown body + the source file link.
  await page.locator('[data-node-type="Observation"] button').first().click();
  await expect(page.getByTestId('node-content')).toContainText('At 43°C');
  await expect(page.getByTestId('node-source')).toBeVisible();

  // Link two nodes (Obsidian-like) and confirm it persists.
  await expect(page.getByTestId('linked-count')).toContainText('0 user links');
  await page.getByTestId('link-mode-toggle').click();
  await page.locator('[data-node-type="Hypothesis"] button').first().click();
  await page.locator('[data-node-type="Protocol"] button').first().click();
  await expect(page.getByTestId('linked-count')).toContainText('1 user link');

  await page.reload();
  await expect(page.getByTestId('linked-count')).toContainText('1 user link');
  await expect(
    page.locator('[data-testid="graph-node"][data-node-type="Observation"]'),
  ).toHaveCount(1);

  // The OKF file tree mirrors the on-disk layout: nodes filed under
  // type directories as .md files.
  await page.getByRole('button', { name: 'Files' }).click();
  const tree = page.getByTestId('okf-tree');
  await expect(tree).toContainText('observations/');
  await expect(tree).toContainText('.md');

  // Group nodes into a cluster — a Knowledge node linked to its members, which
  // can then be linked to other nodes/clusters like anything else.
  await page.getByRole('button', { name: 'Cells', exact: true }).click();
  await page.getByTestId('group-mode-toggle').click();
  await page.locator('[data-node-type="Hypothesis"] button').first().click();
  await page.locator('[data-node-type="Observation"] button').first().click();
  const bar = page.getByTestId('cluster-bar');
  await expect(bar).toContainText('2 selected');
  await bar.getByLabel('Cluster name').fill('Thermal stress');
  await bar.getByRole('button', { name: 'Form cluster' }).click();
  await expect(
    page.locator('[data-testid="graph-node"][data-node-type="Knowledge"]'),
  ).toHaveCount(1);
  await expect(page.getByTestId('linked-count')).toContainText('3 user links');
});

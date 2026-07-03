import { expect, type Page } from '@playwright/test';

// Create a Hypothesis via the graph composer (the single create surface since
// the overview was retired), place it on the board, and open its detail panel —
// where literature search, attached references, and the grounded challenge live.
export async function seedHypothesisAndOpen(
  page: Page,
  statement: string,
): Promise<void> {
  await page.getByTestId('open-graph').click();
  await expect(page.getByTestId('knowledge-canvas')).toBeVisible();
  await page.getByTestId('add-node-toggle').click();
  const composer = page.getByTestId('node-composer');
  await composer
    .getByRole('button', { name: 'Hypothesis', exact: true })
    .click();
  await composer.getByLabel('Node title').fill(statement);
  await composer.getByRole('button', { name: 'Add' }).click();
  await page
    .getByTestId('tray-node')
    .filter({ hasText: statement })
    .first()
    .dragTo(page.getByTestId('hex-drop').first());
  await page
    .locator('[data-testid="graph-node"][data-node-type="Hypothesis"]')
    .first()
    .click();
  await expect(page.getByTestId('node-panel')).toBeVisible();
}

// Create a Protocol via the graph composer, then open its notebook from the
// sidebar Notebooks section (opens the editor in a tab).
export async function createProtocolAndOpen(
  page: Page,
  title: string,
): Promise<void> {
  await page.getByTestId('open-graph').click();
  await expect(page.getByTestId('knowledge-canvas')).toBeVisible();
  await page.getByTestId('add-node-toggle').click();
  const composer = page.getByTestId('node-composer');
  await composer.getByRole('button', { name: 'Protocol', exact: true }).click();
  await composer.getByLabel('Node title').fill(title);
  await composer.getByRole('button', { name: 'Add' }).click();
  await page.locator('aside').getByRole('button', { name: title }).click();
  await expect(page.getByTestId('cell-list')).toBeVisible();
}

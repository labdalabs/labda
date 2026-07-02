import { test, expect } from '@playwright/test';

// The VS Code plugin (issue #11) hosts /app in a webview and must open with no
// signup. This verifies the web behavior the plugin relies on: an
// unauthenticated visit to /app renders the workspace shell (not a redirect to
// sign-in), with a sign-in prompt; AI/write actions are gated behind sign-in.
test('zero-friction: /app is browsable without signing in', async ({ page }) => {
  await page.goto('/app');

  // Not redirected to the sign-in page.
  await expect(page).toHaveURL(/\/app$/);

  // The workspace shell renders.
  await expect(
    page.getByRole('heading', { name: 'Projects', exact: true }),
  ).toBeVisible();

  // A sign-in prompt is shown, and the create form is NOT (auth-gated).
  await expect(page.getByTestId('signin-banner')).toBeVisible();
  await expect(page.getByTestId('create-project-form')).toHaveCount(0);
});

import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run the local dev servers before starting the tests. The API (Nest +
   * GraphQL + MCP) and the UI (Next.js) both need to be up; Supabase is
   * expected to already be running (`pnpm supabase start`). */
  webServer: [
    {
      // Deterministic Semantic Scholar stub so literature search e2e isn't at
      // the mercy of the public API's rate limits.
      command: 'node apps/ui-e2e/src/support/s2-stub.mjs',
      url: 'http://127.0.0.1:4599/health',
      reuseExistingServer: true,
      timeout: 30_000,
      cwd: workspaceRoot,
    },
    {
      // Point the API at the stub for the literature corpus during e2e.
      command:
        'SEMANTIC_SCHOLAR_BASE_URL=http://127.0.0.1:4599 pnpm exec nx run api:serve',
      url: 'http://localhost:3001/api',
      reuseExistingServer: false,
      timeout: 180_000,
      cwd: workspaceRoot,
    },
    {
      // Nx injects the root `.env` (which sets PORT=3001 for the API) into
      // every task, so pin the UI to 3000 explicitly here.
      command: 'PORT=3000 pnpm exec nx run ui:dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 180_000,
      cwd: workspaceRoot,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});

# Labda — VS Code extension

A thin **plugin shell** that hosts the Labda Next.js web app inside a VS Code
webview (PDR-001's migratable-webview decision). The extension is a host; the
webview stays a portable web app, loaded by URL, so the same UI moves unchanged
to a hosted browser build later.

## Zero-friction

- Installing the extension and opening the panel needs **no signup**.
- The hosted app only prompts auth (Supabase OTP) at the **first AI-backed
  action** — browsing the workspace needs none (the web app renders a signed-out
  browse state; AI/write actions trigger sign-in).

## What it contributes

- A **Labda** activity-bar view (`labda.workspace`) hosting the app.
- Commands: **Labda: Open Workspace** (opens the app in an editor panel) and
  **Labda: Reload Webview**.
- Setting `labda.webviewUrl` (default `http://localhost:3000/app`) — point it at
  your local dev server or a hosted deployment.

## Run it (desktop VS Code)

1. Start the web app (and API) from the repo root:
   ```bash
   pnpm nx run api:serve      # backend
   PORT=3000 pnpm nx run ui:dev   # frontend on http://localhost:3000
   ```
2. Build the extension:
   ```bash
   pnpm nx run plugin:build   # or, from apps/plugin: npm run build
   ```
3. Launch the Extension Development Host: open `apps/plugin` in VS Code and press
   **F5** (uses `.vscode/launch.json`). A second VS Code window opens with the
   extension loaded.
4. Click the **Labda** icon in the activity bar, or run **Labda: Open Workspace**
   from the command palette.

### Package as a `.vsix` (optional)

```bash
cd apps/plugin
npx @vscode/vsce package    # produces labda-vscode-0.0.1.vsix
```

Install it with **Extensions: Install from VSIX…** in VS Code.

## Portability

The webview only embeds the app via an `<iframe>` and never calls VS Code APIs
from the page. Swapping the host (standalone browser, hosted build) is a matter
of pointing something else at the same URL — the app does not know it is inside
VS Code.

import * as vscode from 'vscode';

// The Labda VS Code extension is a thin shell: it hosts the existing Next.js
// web app inside a webview (PDR-001's migratable-webview decision). The webview
// stays a portable app — it is loaded by URL via an iframe and does not depend
// on VS Code APIs beyond this host. Nothing here requires signup; the hosted
// app itself only prompts auth (Supabase OTP) at the first AI-backed action.

const VIEW_TYPE = 'labda.workspace';

function webviewUrl(): string {
  return vscode.workspace
    .getConfiguration('labda')
    .get<string>('webviewUrl', 'http://localhost:3000/app');
}

function renderHtml(url: string): string {
  // The webview hosts the app in an iframe so it remains a portable web app.
  // CSP allows framing localhost (dev) and https (hosted) origins only.
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "frame-src http://localhost:* https:",
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, iframe { margin: 0; padding: 0; height: 100%; width: 100%; border: 0; }
      body { background: #0b0b0b; }
    </style>
  </head>
  <body>
    <iframe src="${url}" allow="clipboard-read; clipboard-write"></iframe>
  </body>
</html>`;
}

// Sidebar view provider — renders the app in the Labda activity-bar view.
class LabdaViewProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = { enableScripts: true };
    view.webview.html = renderHtml(webviewUrl());
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      VIEW_TYPE,
      new LabdaViewProvider(),
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  // Command: open the workspace in a full editor panel.
  context.subscriptions.push(
    vscode.commands.registerCommand('labda.open', () => {
      const panel = vscode.window.createWebviewPanel(
        'labda.panel',
        'Labda',
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true },
      );
      panel.webview.html = renderHtml(webviewUrl());
    }),
  );

  // Command: reload the sidebar view after changing the URL.
  context.subscriptions.push(
    vscode.commands.registerCommand('labda.reload', async () => {
      await vscode.commands.executeCommand('labda.workspace.focus');
      vscode.window.showInformationMessage('Labda: reopen the panel to reload.');
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up — the webview is torn down by VS Code.
}

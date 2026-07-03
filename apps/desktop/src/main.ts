import { app, BrowserWindow, shell } from 'electron';
import path from 'path';

/**
 * URL of the labda UI the desktop shell wraps. Opens the workspace (/app)
 * rather than the marketing landing page.
 * - Packaged app: production UI (override with LABDA_APP_URL)
 * - Dev (`electron .`): `pnpm nx dev ui` on http://localhost:4200
 */
const APP_URL =
  process.env.LABDA_APP_URL ??
  (app.isPackaged ? 'https://labda.app/app' : 'http://localhost:4200/app');
const RETRY_DELAY_MS = 1500;

let mainWindow: BrowserWindow | null = null;
// A deep link that arrived before the window was ready (cold start).
let pendingDeepLink: string | null = null;

// Custom-protocol sign-in (magic link → PKCE). The email link opens the system
// browser, which can't finish PKCE (no code_verifier there). The web callback
// bounces the code back to us as `labda://auth?code=…`; we load the callback in
// THIS window — whose cookie jar holds the verifier from when it started the
// sign-in — so the exchange succeeds and the app is signed in.
function handleDeepLink(url: string): void {
  try {
    const u = new URL(url);
    if (u.protocol !== 'labda:') return;
    const code = u.searchParams.get('code');
    if (!code) return;
    const next = u.searchParams.get('next') ?? '/app';
    const origin = new URL(APP_URL).origin;
    const callback = `${origin}/auth/callback?code=${encodeURIComponent(
      code,
    )}&next=${encodeURIComponent(next)}`;
    if (mainWindow) {
      void mainWindow.loadURL(callback);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      pendingDeepLink = callback;
    }
  } catch {
    // Ignore malformed deep links.
  }
}

function isInAppUrl(url: string): boolean {
  try {
    return new URL(url).origin === new URL(APP_URL).origin;
  } catch {
    return false;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#8FC0DE',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Keep auth/API navigation inside the app; everything else goes to the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInAppUrl(url)) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isInAppUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  // If the UI isn't up yet (dev server still booting), retry instead of showing a blank window.
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.warn(`Failed to load ${APP_URL} (${code} ${description}); retrying in ${RETRY_DELAY_MS}ms`);
    setTimeout(() => void mainWindow?.loadURL(APP_URL), RETRY_DELAY_MS);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // A cold-start magic-link deep link loads the callback directly.
  const initial = pendingDeepLink ?? APP_URL;
  pendingDeepLink = null;
  void mainWindow.loadURL(initial);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  // Register the labda:// scheme so macOS routes magic-link deep links to us.
  // (Packaged builds also declare it in Info.plist via electron-builder.)
  app.setAsDefaultProtocolClient('labda');

  // macOS delivers deep links via open-url — early for a cold start, live when
  // the app is already running. Registered at load so a cold-start link isn't
  // missed.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Packaged builds get the icon from the bundle; dev runs show the stock
    // Electron dock icon unless we set it explicitly.
    if (!app.isPackaged && process.platform === 'darwin') {
      app.dock?.setIcon(path.join(__dirname, '..', 'build', 'icon.png'));
    }
    createWindow();
  });

  // macOS: re-create the window when the dock icon is clicked and none are open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // macOS convention: keep the app alive until the user quits explicitly.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

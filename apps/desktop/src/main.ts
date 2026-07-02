import { app, BrowserWindow, shell } from 'electron';
import path from 'path';

/**
 * URL of the labda UI the desktop shell wraps.
 * - Dev: `pnpm nx dev ui` serves it on http://localhost:4200
 * - Prod: set LABDA_APP_URL to the deployed UI origin when packaging/launching
 */
const APP_URL = process.env.LABDA_APP_URL ?? 'http://localhost:4200';
const RETRY_DELAY_MS = 1500;

let mainWindow: BrowserWindow | null = null;

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

  void mainWindow.loadURL(APP_URL);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  // macOS: re-create the window when the dock icon is clicked and none are open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // macOS convention: keep the app alive until the user quits explicitly.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

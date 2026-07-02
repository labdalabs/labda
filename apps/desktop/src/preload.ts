import { contextBridge } from 'electron';

// Minimal, read-only surface exposed to the web app so it can detect the desktop shell.
contextBridge.exposeInMainWorld('labdaDesktop', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
});

import electron from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { app, BrowserWindow, nativeTheme, ipcMain } = electron;

const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? 'http://127.0.0.1:5173';
const backendUrl = process.env.ELECTRON_BACKEND_URL ?? 'http://127.0.0.1:5001';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const rendererTarget = new URL(rendererUrl);
  rendererTarget.searchParams.set('backendUrl', backendUrl);

  void win.loadURL(rendererTarget.toString());
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  createWindow();

  ipcMain.on('set-theme', (_, theme) => {
    nativeTheme.themeSource = theme;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

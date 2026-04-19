import electron from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { app, BrowserWindow, nativeTheme, ipcMain, shell } = electron;

const isProd = app.isPackaged;
let rendererUrl = process.env.ELECTRON_RENDERER_URL ?? 'http://127.0.0.1:5173';
let backendUrl = process.env.ELECTRON_BACKEND_URL ?? 'http://127.0.0.1:5001';

let backendProcess: ChildProcess | null = null;

function findFreePort(defaultPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      const fallbackServer = net.createServer();
      fallbackServer.unref();
      fallbackServer.on('error', reject);
      fallbackServer.listen(0, '127.0.0.1', () => {
        const port = (fallbackServer.address() as net.AddressInfo).port;
        fallbackServer.close(() => resolve(port));
      });
    });
    server.listen(defaultPort, '127.0.0.1', () => {
      server.close(() => resolve(defaultPort));
    });
  });
}

async function createWindow() {
  if (isProd) {
    try {
      const port = await findFreePort(5050);
      backendUrl = `http://127.0.0.1:${port}`;
      // In production, the backend is packed into resources/backend/
      const backendExe = path.join(process.resourcesPath, 'backend', 'backend.exe');
      backendProcess = spawn(backendExe, ['--urls', backendUrl], { detached: false });
      
      backendProcess.stdout?.on('data', (data) => console.log(`[BACKEND] ${data.toString()}`));
      backendProcess.stderr?.on('data', (data) => console.error(`[BACKEND ERR] ${data.toString()}`));
    } catch (err) {
      console.error('Failed to start internal backend:', err);
    }
  }

  const win = new BrowserWindow({
    title: 'DBI Platform',
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Bắt mọi lệnh `window.open` hoặc thẻ <a target="_blank">
  // Chặn Electron mở popup nội bộ và ép văng ra Chrome/trình duyệt của OS.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isProd) {
    const indexPath = path.join(process.resourcesPath, 'frontend', 'index.html');
    void win.loadFile(indexPath, { search: `?backendUrl=${encodeURIComponent(backendUrl)}` });
  } else {
    const rendererTarget = new URL(rendererUrl);
    rendererTarget.searchParams.set('backendUrl', backendUrl);
    void win.loadURL(rendererTarget.toString());
  }

  // Handle beforeunload properly in Electron
  win.webContents.on('will-prevent-unload', (event) => {
    const { dialog } = electron;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Close', 'Cancel'],
      title: 'Unsaved Changes',
      message: 'You have unsaved configuration changes. Closing now will result in data loss.',
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    
    if (choice === 0) {
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  void createWindow();

  ipcMain.on('set-theme', (_, theme) => {
    nativeTheme.themeSource = theme;
  });

  ipcMain.on('open-external', (_, url: string) => {
    shell.openExternal(url);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (backendProcess) {
    console.log('[ELECTRON] Shutting down internal .NET backend...');
    backendProcess.kill();
  }
});

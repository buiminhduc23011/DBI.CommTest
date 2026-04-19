import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setTheme: (theme: 'light' | 'dark') => ipcRenderer.send('set-theme', theme),
  forceQuit: () => ipcRenderer.send('force-quit'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  onWindowCloseRequest: (callback: () => void) => {
    const handler = (_event: IpcRendererEvent) => callback();
    ipcRenderer.on('window-close-request', handler);
    return () => ipcRenderer.removeListener('window-close-request', handler);
  }
});

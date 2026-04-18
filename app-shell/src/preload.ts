import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setTheme: (theme: 'light' | 'dark') => ipcRenderer.send('set-theme', theme),
});

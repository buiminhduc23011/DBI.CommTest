import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    setTheme: (theme) => ipcRenderer.send('set-theme', theme),
});

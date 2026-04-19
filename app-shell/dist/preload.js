import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    setTheme: (theme) => ipcRenderer.send('set-theme', theme),
    forceQuit: () => ipcRenderer.send('force-quit'),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    onWindowCloseRequest: (callback) => {
        const handler = (_event) => callback();
        ipcRenderer.on('window-close-request', handler);
        return () => ipcRenderer.removeListener('window-close-request', handler);
    }
});

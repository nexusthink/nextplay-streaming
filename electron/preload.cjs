const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nextplayDesktop', {
  isElectron: true,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  close: () => ipcRenderer.invoke('window:close'),
});


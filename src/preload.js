const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath)
});
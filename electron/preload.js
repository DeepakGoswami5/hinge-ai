const { contextBridge, ipcRenderer } = require('electron')

const electronAPI = {
  requestScreenAccess: () => ipcRenderer.invoke('request-screen-access'),
  getWindowSources: () => ipcRenderer.invoke('get-window-sources'),
  captureFrame: (sourceId) => ipcRenderer.invoke('capture-frame', sourceId),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

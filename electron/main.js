const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron')
const path = require('node:path')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  const devServer = process.env.VITE_DEV_SERVER_URL
  if (devServer) {
    mainWindow.loadURL(devServer)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('request-screen-access', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
  return sources.length > 0
})

ipcMain.handle('get-window-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    type: source.type,
  }))
})

ipcMain.handle('capture-frame', async (_event, sourceId) => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
  const source = sources.find((item) => item.id === sourceId)
  if (!source) {
    return null
  }

  return source.thumbnail ? await source.thumbnail.toDataURL() : null
})

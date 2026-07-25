import { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences } from 'electron'
import type { Stream } from 'node:stream'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

const createWindow = () => {
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
  try {
    if (process.platform === 'darwin') {
      const currentStatus = systemPreferences.getMediaAccessStatus('screen')
      if (currentStatus !== 'granted') {
        await systemPreferences.askForMediaAccess('screen')
      }
      return systemPreferences.getMediaAccessStatus('screen') === 'granted'
    }

    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
    return sources.length > 0
  } catch (error) {
    console.error('Screen access request failed', error)
    return false
  }
})

ipcMain.handle('get-window-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    type: source.type,
  }))
})

ipcMain.handle('capture-frame', async (_event, sourceId: string) => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
    const source = sources.find((item) => item.id === sourceId)
    if (!source) {
      return null
    }

    try {
      const stream = await source.createStream({
        width: 2560,
        height: 1600,
        quality: 100,
      })

      const chunks: Buffer[] = []
      const streamReader = stream as unknown as Stream & {
        on(event: 'data' | 'end' | 'error', listener: (...args: unknown[]) => void): unknown
      }

      await new Promise<void>((resolve, reject) => {
        streamReader.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        streamReader.on('end', () => resolve())
        streamReader.on('error', reject)
      })

      const buffer = Buffer.concat(chunks)
      if (buffer.length > 0) {
        return `data:image/png;base64,${buffer.toString('base64')}`
      }
    } catch (streamError) {
      console.warn('Stream capture failed, falling back to thumbnail', streamError)
    }

    if (source.thumbnail && typeof source.thumbnail.toDataURL === 'function') {
      const thumbnail = source.thumbnail.resize({ width: 2560, height: 1600 })
      return thumbnail.toDataURL()
    }

    return null
  } catch (error) {
    console.error('Capture failed', error)
    return null
  }
})

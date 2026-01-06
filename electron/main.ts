import { app, BrowserWindow, ipcMain, screen, desktopCapturer } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { fork, ChildProcess } from 'node:child_process'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null = null
let overlayWin: BrowserWindow | null = null
let serverProcess: ChildProcess | null = null

const SERVER_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'server', 'dark-server.js')
  : path.join(process.env.APP_ROOT, 'server', 'dark-server.js')

function startServer() {
  console.log('Starting dark-server at:', SERVER_PATH)
  serverProcess = fork(SERVER_PATH, [], {
    stdio: 'inherit',
    env: { ...process.env, PORT: '3000', WS_PORT: '9998' }
  })
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 600,
    height: 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function createOverlayWindow() {
  if (overlayWin) {
    overlayWin.show()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.bounds

  overlayWin = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allow loading local base64
    }
  })

  const urlToLoad = VITE_DEV_SERVER_URL
    ? `${VITE_DEV_SERVER_URL}#/overlay`
    : `file://${path.join(RENDERER_DIST, 'index.html')}#/overlay`

  overlayWin.loadURL(urlToLoad)

  // overlayWin.webContents.openDevTools({ mode: "detach" })

  overlayWin.on('closed', () => {
    overlayWin = null
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopServer()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  startServer()
  createWindow()

  ipcMain.on('start-scan', () => {
    createOverlayWindow()
  })

  ipcMain.on('close-overlay', () => {
    if (overlayWin) {
      overlayWin.close()
      overlayWin = null
    }
  })

  ipcMain.on('resize-me', (_event, { width, height }) => {
    if (win) {
      win.setBounds({ width, height })
      // win.center()
    }
  })

  ipcMain.handle('get-screen-image', async () => {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.bounds
    // Get correct scale factor
    const scaleFactor = primaryDisplay.scaleFactor || 1

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: width * scaleFactor,
        height: height * scaleFactor
      }
    })

    // Return the first screen source
    return sources[0].thumbnail.toDataURL()
  })

  ipcMain.on('app-quit', () => {
    app.quit()
  })
})

import { app, BrowserWindow, ipcMain, screen, desktopCapturer } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { fork, ChildProcess } from 'node:child_process'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// CRITICAL: Disable Hardware Acceleration to fix visual glitches on Windows with transparent windows
app.disableHardwareAcceleration()

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// ============= WINDOW REFERENCES =============
let toolbarWin: BrowserWindow | null = null
let overlayWin: BrowserWindow | null = null
let serverProcess: ChildProcess | null = null

// ============= SERVER PATH =============
const SERVER_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'server', 'dark-server.js')
  : path.join(process.env.APP_ROOT, 'server', 'dark-server.js')

// ============= SERVER MANAGEMENT =============
function startServer() {
  console.log('Starting dark-server at:', SERVER_PATH)
  serverProcess = fork(SERVER_PATH, [], {
    stdio: 'inherit',
    env: { ...process.env }
  })
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}

// ============= TOOLBAR WINDOW (Window A) =============
function createToolbarWindow() {
  toolbarWin = new BrowserWindow({
    width: 500,
    height: 70,
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

  // Load Toolbar Route (default route or #/toolbar)
  if (VITE_DEV_SERVER_URL) {
    toolbarWin.loadURL(VITE_DEV_SERVER_URL) // Default route is Toolbar
  } else {
    toolbarWin.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  toolbarWin.on('closed', () => {
    toolbarWin = null
    // When toolbar closes, quit app
    app.quit()
  })
}

// ============= OVERLAY WINDOW (Window B) =============
function createOverlayWindow() {
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
    show: false, // HIDDEN by default
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  })

  // Load Overlay Route
  const overlayUrl = VITE_DEV_SERVER_URL
    ? `${VITE_DEV_SERVER_URL}#/overlay`
    : `file://${path.join(RENDERER_DIST, 'index.html')}#/overlay`

  overlayWin.loadURL(overlayUrl)

  overlayWin.on('closed', () => {
    overlayWin = null
  })
}

// ============= APP LIFECYCLE =============
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
    createToolbarWindow()
    createOverlayWindow()
  }
})

app.whenReady().then(() => {
  startServer()
  createToolbarWindow()
  createOverlayWindow()

  // ============= IPC HANDLERS =============

  // Show Overlay when Scan is triggered
  ipcMain.on('trigger-scan', async () => {
    if (overlayWin) {
      // Capture screen BEFORE showing overlay to avoid capturing itself
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width, height } = primaryDisplay.bounds
      const scaleFactor = primaryDisplay.scaleFactor || 1

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: width * scaleFactor,
          height: height * scaleFactor
        }
      })

      const screenImage = sources[0].thumbnail.toDataURL()

      // Send image to overlay before showing it
      overlayWin.webContents.send('screen-captured', screenImage)
      overlayWin.show()
      overlayWin.focus()
    }
  })

  // Hide Overlay when done
  ipcMain.on('hide-overlay', () => {
    if (overlayWin) {
      overlayWin.hide()
    }
  })

  // Forward translation result to Toolbar
  ipcMain.on('translation-result', (_event, result: string) => {
    if (toolbarWin) {
      toolbarWin.webContents.send('translation-result', result)
    }
  })

  // Toolbar resize (for Settings Panel expand/collapse)
  ipcMain.on('resize-toolbar', (_event, { width, height }) => {
    if (toolbarWin) {
      toolbarWin.setBounds({ width, height })
    }
  })

  // Quit App
  ipcMain.on('app-quit', () => {
    app.quit()
  })
})

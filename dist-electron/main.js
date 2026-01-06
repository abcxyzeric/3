import { app, BrowserWindow, ipcMain, screen, desktopCapturer } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fork } from "node:child_process";
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
app.disableHardwareAcceleration();
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let toolbarWin = null;
let overlayWin = null;
let serverProcess = null;
const SERVER_PATH = app.isPackaged ? path.join(process.resourcesPath, "server", "dark-server.js") : path.join(process.env.APP_ROOT, "server", "dark-server.js");
function startServer() {
  console.log("Starting dark-server at:", SERVER_PATH);
  serverProcess = fork(SERVER_PATH, [], {
    stdio: "inherit",
    env: { ...process.env }
  });
}
function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}
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
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });
  if (VITE_DEV_SERVER_URL) {
    toolbarWin.loadURL(VITE_DEV_SERVER_URL);
  } else {
    toolbarWin.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  toolbarWin.on("closed", () => {
    toolbarWin = null;
    app.quit();
  });
}
function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;
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
    show: false,
    // HIDDEN by default
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });
  const overlayUrl = VITE_DEV_SERVER_URL ? `${VITE_DEV_SERVER_URL}#/overlay` : `file://${path.join(RENDERER_DIST, "index.html")}#/overlay`;
  overlayWin.loadURL(overlayUrl);
  overlayWin.on("closed", () => {
    overlayWin = null;
  });
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
  stopServer();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createToolbarWindow();
    createOverlayWindow();
  }
});
app.whenReady().then(() => {
  startServer();
  createToolbarWindow();
  createOverlayWindow();
  ipcMain.on("trigger-scan", async () => {
    if (overlayWin) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.bounds;
      const scaleFactor = primaryDisplay.scaleFactor || 1;
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: {
          width: width * scaleFactor,
          height: height * scaleFactor
        }
      });
      const screenImage = sources[0].thumbnail.toDataURL();
      overlayWin.webContents.send("screen-captured", screenImage);
      overlayWin.show();
      overlayWin.focus();
    }
  });
  ipcMain.on("hide-overlay", () => {
    if (overlayWin) {
      overlayWin.hide();
    }
  });
  ipcMain.on("translation-result", (_event, result) => {
    if (toolbarWin) {
      toolbarWin.webContents.send("translation-result", result);
    }
  });
  ipcMain.on("resize-toolbar", (_event, { width, height }) => {
    if (toolbarWin) {
      toolbarWin.setBounds({ width, height });
    }
  });
  ipcMain.on("app-quit", () => {
    app.quit();
  });
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};

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
let commanderWin = null;
let chatWin = null;
let overlayWin = null;
let serverProcess = null;
let currentMode = "chatbox";
const SERVER_PATH = app.isPackaged ? path.join(process.resourcesPath, "server", "dark-server.js") : path.join(process.env.APP_ROOT, "server", "dark-server.js");
function startServer() {
  console.log("Starting dark-server at:", SERVER_PATH);
  serverProcess = fork(SERVER_PATH, [], { stdio: "inherit", env: { ...process.env } });
}
function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}
function createCommanderWindow() {
  commanderWin = new BrowserWindow({
    width: 420,
    height: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });
  if (VITE_DEV_SERVER_URL) {
    commanderWin.loadURL(VITE_DEV_SERVER_URL);
  } else {
    commanderWin.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  commanderWin.on("closed", () => {
    commanderWin = null;
    app.quit();
  });
}
function createChatWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  chatWin = new BrowserWindow({
    width: 400,
    height: 500,
    x: screenWidth - 420,
    y: screenHeight - 550,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    hasShadow: false,
    show: true,
    // Visible by default in Chatbox mode
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });
  const chatUrl = VITE_DEV_SERVER_URL ? `${VITE_DEV_SERVER_URL}#/chat` : `file://${path.join(RENDERER_DIST, "index.html")}#/chat`;
  chatWin.loadURL(chatUrl);
  chatWin.on("closed", () => {
    chatWin = null;
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
    // Hidden by default
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
    createCommanderWindow();
    createChatWindow();
    createOverlayWindow();
  }
});
app.whenReady().then(() => {
  startServer();
  createCommanderWindow();
  createChatWindow();
  createOverlayWindow();
  ipcMain.on("set-mode", (_event, mode) => {
    currentMode = mode;
    if (mode === "chatbox") {
      chatWin == null ? void 0 : chatWin.show();
      overlayWin == null ? void 0 : overlayWin.hide();
    }
  });
  ipcMain.on("trigger-scan", async () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;
    const scaleFactor = primaryDisplay.scaleFactor || 1;
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: width * scaleFactor, height: height * scaleFactor }
    });
    const screenImage = sources[0].thumbnail.toDataURL();
    if (currentMode === "overlay") {
      overlayWin == null ? void 0 : overlayWin.webContents.send("screen-captured", screenImage);
      overlayWin == null ? void 0 : overlayWin.show();
      overlayWin == null ? void 0 : overlayWin.focus();
    } else {
      overlayWin == null ? void 0 : overlayWin.webContents.send("screen-captured", screenImage);
      overlayWin == null ? void 0 : overlayWin.show();
      overlayWin == null ? void 0 : overlayWin.focus();
    }
  });
  ipcMain.on("hide-overlay", () => {
    if (currentMode === "chatbox") {
      overlayWin == null ? void 0 : overlayWin.hide();
    }
  });
  ipcMain.on("translation-result", (_event, data) => {
    if (currentMode === "chatbox") {
      chatWin == null ? void 0 : chatWin.webContents.send("new-message", data.text);
      overlayWin == null ? void 0 : overlayWin.hide();
    } else {
      overlayWin == null ? void 0 : overlayWin.webContents.send("show-patch", data);
    }
  });
  ipcMain.on("clear-patches", () => {
    overlayWin == null ? void 0 : overlayWin.webContents.send("clear-patches");
    overlayWin == null ? void 0 : overlayWin.hide();
  });
  ipcMain.on("resize-commander", (_event, { width, height }) => {
    if (commanderWin) {
      commanderWin.setBounds({ width, height });
    }
  });
  ipcMain.on("toggle-chat-clickthrough", (_event, enabled) => {
    if (chatWin) {
      chatWin.setIgnoreMouseEvents(enabled, { forward: true });
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

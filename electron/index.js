const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

autoUpdater.checkForUpdatesAndNotify();
const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    autoHideMenuBar: true,
    contextIsolation: false,
    nodeIntegration: true,
    enableRemoteModule: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.loadFile("index.html");
};

app.whenReady().then(() => {
  createWindow();
});

// Expose all node functions to invoke
const fs = require("fs");
for (const [key, val] of Object.entries(fs)) {
  if (typeof val === "function") {
    ipcMain.handle(key, (event, ...args) => {
      return val(...args);
    });
  }
}

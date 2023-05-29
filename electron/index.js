const { app, BrowserWindow, ipcMain, protocol } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const dialog = require("electron").dialog;

autoUpdater.on("update-available", (info) => {
  dialog
    .showMessageBox({
      type: "info",
      title: "Update Available",
      message: "A new update is available. Do you want to install it?",
      buttons: ["Install", "Cancel"],
    })
    .then((result) => {
      if (result.response === 0) {
        // User clicked 'Install', start downloading and installing the update
        autoUpdater.downloadUpdate();
      }
    });
});
autoUpdater.on("download-progress", (progress) => {
  console.log("download progress", progress.percent);
});
autoUpdater.on("update-downloaded", () => {
  autoUpdater.quitAndInstall(false, true);
});

autoUpdater.autoDownload = false;
autoUpdater.autoRunAppAfterInstall = true;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.checkForUpdates();
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
  ipcMain.handle("showOpenDialog", async (event, ...args) => {
    return await dialog.showOpenDialog(win, ...args);
  });
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
ipcMain.handle("isDirectory", async (event, ...args) => {
  const stats = fs.statSync(...args);
  return stats.isDirectory();
});
ipcMain.handle("isFile", async (event, ...args) => {
  const stats = fs.statSync(...args);
  return stats.isFile();
});
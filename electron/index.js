const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

// Configure update events
autoUpdater.on("checking-for-update", () => {
  console.log("checking for update");
});

autoUpdater.on("update-available", (info) => {
  console.log("update available", info);
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

autoUpdater.on("update-not-available", (info) => {
  console.log("no update available");
});

autoUpdater.on("download-progress", (progress) => {
  console.log("download progress", progress);
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("update downloaded");
  dialog
    .showMessageBox({
      type: "info",
      title: "Update Downloaded",
      message: "The update has been downloaded. Do you want to install it now?",
      buttons: ["Install", "Later"],
    })
    .then((result) => {
      if (result.response === 0) {
        // User clicked 'Install', quit and install the update
        autoUpdater.quitAndInstall();
      }
    });
});

// Check for updates and notify the user
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

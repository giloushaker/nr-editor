const { app, BrowserWindow, ipcMain, protocol, session } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const dialog = require("electron").dialog;

let mainWindow;
let previousTitle = "";
function askForUpdate() {
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
    mainWindow.webContents.executeJavaScript(`
    const styleElement = document.createElement('style');
    styleElement.setAttribute('id', 'custom-style');
    styleElement.textContent = 'body { cursor: progress !important; }';
    document.head.appendChild(styleElement);
    `);
    let log_message = "Download speed: " + progress.bytesPerSecond;
    log_message = log_message + " - Downloaded " + progress.percent + "%";
    log_message = log_message + " (" + progress.transferred + "/" + progress.total + ")";
    mainWindow.setProgressBar(progress.percent / 100);
    mainWindow.setTitle(progress.percent + "%");
  });
  autoUpdater.on("update-downloaded", () => {
    mainWindow.webContents.executeJavaScript(`
    if (styleElement) styleElement.remove();
    `);
    mainWindow.setTitle(previousTitle);
    autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.autoDownload = false;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.checkForUpdates();
}

const createSecondaryWindow = () => {
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
  win.loadFile("index.html", {
    hash: "/system",
  });
};
const createMainWindow = () => {
  askForUpdate();

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

  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    delete details.requestHeaders["Origin"];
    delete details.requestHeaders["Referer"];
    callback({ requestHeaders: details.requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    if (details.responseHeaders) {
      details.responseHeaders["Access-Control-Allow-Origin"] = ["*"];
    }
    callback({ responseHeaders: details.responseHeaders });
  });

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

  mainWindow = win;
  win.loadFile("index.html", {
    hash: "/system",
  });
  previousTitle = win.getTitle();
  ipcMain.handle("showOpenDialog", async (event, ...args) => {
    const wnd = BrowserWindow.fromWebContents(event.sender);
    return await dialog.showOpenDialog(wnd, ...args);
  });
  ipcMain.handle("showMessageBoxSync", async (event, ...args) => {
    const wnd = BrowserWindow.fromWebContents(event.sender);
    return await dialog.showMessageBoxSync(wnd, ...args);
  });
  ipcMain.handle("getPath", async (event, ...args) => {
    return await app.getPath(...args);
  });
  ipcMain.handle("closeWindow", async (event, ...args) => {
    const wnd = BrowserWindow.fromWebContents(event.sender);
    return await wnd.close(...args);
  });
};
const filter = { urls: ["https://*/*"] };

app.whenReady().then(() => {
  if (app.requestSingleInstanceLock()) {
    createMainWindow();
    app.on("second-instance", () => {
      createSecondaryWindow();
    });
  }
});

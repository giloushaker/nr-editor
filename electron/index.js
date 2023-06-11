const { app, BrowserWindow, ipcMain, protocol, session, shell } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const dialog = require("electron").dialog;

const { readFile, readdir, stat } = require("fs/promises");

const zipExtensions = ["gstz", "zip", "catz"];
function getExtension(extension_or_file) {
  const extension = extension_or_file.split(".").pop().toLowerCase();
  return extension;
}
function isZipExtension(extension_or_file) {
  const extension = getExtension(extension_or_file);
  return zipExtensions.includes(extension);
}

function dirname(path) {
  return path.replaceAll("\\", "/").split("/").slice(0, -1).join("/");
}
async function isFile(f) {
  const stats = await stat(f);
  return stats.isFile();
}

var AdmZip = require("adm-zip");
async function readAndUnzipFile(path) {
  try {
    if (!(await isFile(path))) return undefined;
    const isZip = isZipExtension(path);
    if (isZip) {
      var zip = new AdmZip(path);
      var zipEntries = zip.getEntries();
      const entry = zipEntries[0];
      return entry.getData().toString("utf-8");
    } else {
      return await readFile(path, "utf-8");
    }
  } catch (e) {
    console.log(e);
    return undefined;
  }
}

async function getFolderFiles(folderPath) {
  const fileObjects = [];
  const isPathFile = await isFile(folderPath);
  if (isPathFile) {
    folderPath = dirname(folderPath);
  }
  const entries = await readdir(folderPath);
  for (const entry of entries) {
    const filePath = `${folderPath}/${entry}`;
    fileObjects.push(readAndUnzipFile(filePath).then((data) => ({ data, name: entry, path: filePath })));
  }

  return (await Promise.all(fileObjects)).filter((o) => o.data);
}

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
    styleElement.textContent = '* { cursor: progress !important; }';
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
    nativeWindowOpen: true,
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
  const promiseFunctions = new Set(Object.keys(fs.promises));
  for (const [key, val] of Object.entries(fs)) {
    if (promiseFunctions.has(key)) continue;
    if (typeof val === "function") {
      ipcMain.handle(key, (event, ...args) => {
        return val(...args);
      });
    }
  }
  for (const [key, val] of Object.entries(fs.promises)) {
    if (typeof val === "function") {
      ipcMain.handle(key, async (event, ...args) => {
        return await val(...args);
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
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow = win;
  win.webContents.setWindowOpenHandler(({ url }) => {
    // config.fileProtocol is my custom file protocol
    console.log("opening url", url);
    if (!url.startsWith("http")) {
      return { action: "allow" };
    }
    // open url in a browser and prevent default
    shell.openExternal(url);
    return { action: "deny" };
  });
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
  ipcMain.handle("getFolderFiles", async (event, ...args) => {
    return await getFolderFiles(...args);
  });
  win.loadFile("index.html", {
    hash: "/system",
  });
  previousTitle = win.getTitle();
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

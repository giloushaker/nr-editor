const { app, BrowserWindow, ipcMain, session, shell } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const dialog = require("electron").dialog;
import { add_watcher, remove_watcher, remove_watchers } from "./filewatch";
const { readFile, readdir, stat } = require("fs/promises");

const zipExtensions = ["gstz", "zip", "catz"];
function getExtension(extension_or_file: string) {
  const extension = extension_or_file.split(".").pop()?.toLowerCase() || "";
  return extension;
}
function isZipExtension(extension_or_file: string) {
  const extension = getExtension(extension_or_file);
  return zipExtensions.includes(extension);
}

function dirname(path: string) {
  return path.replaceAll("\\", "/").split("/").slice(0, -1).join("/");
}
async function isFile(f: any) {
  const stats = await stat(f);
  return stats.isFile();
}

var AdmZip = require("adm-zip");
async function readAndUnzipFile(path: string) {
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

async function getFolderFiles(folderPath: any) {
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

let mainWindow: {
  webContents: { executeJavaScript: (arg0: string) => void };
  setProgressBar: (arg0: number) => void;
  setTitle: (arg0: string) => void;
};
let previousTitle = "";
function askForUpdate() {
  autoUpdater.on("update-available", (info: any) => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Available",
        message: "A new update is available. Do you want to install it?",
        buttons: ["Install", "Cancel"],
      })
      .then((result: { response: number }) => {
        if (result.response === 0) {
          // User clicked 'Install', start downloading and installing the update
          autoUpdater.downloadUpdate();
        }
      });
  });
  autoUpdater.on(
    "download-progress",
    (progress: { bytesPerSecond: string; percent: string | number; transferred: string; total: string }) => {
      try {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.executeJavaScript(`
        if (!globalThis.styleElement){
          globalThis.styleElement = document.createElement('style');
        }
        globalThis.styleElement.setAttribute('id', 'custom-style');
        globalThis.styleElement.textContent = '* { cursor: progress !important; }';
        document.head.appendChild(globalThis.styleElement);
        `);
        }
        if (mainWindow) {
          let log_message = "Download speed: " + progress.bytesPerSecond;
          log_message = log_message + " - Downloaded " + progress.percent + "%";
          log_message = log_message + " (" + progress.transferred + "/" + progress.total + ")";
          const progress_percent = Math.round(Number(progress.percent) * 10) / 10;
          mainWindow.setProgressBar(progress_percent / 100);
          mainWindow.setTitle(progress_percent + "%");
        }
      } catch (e) {
        console.error(e);
      }
    }
  );
  autoUpdater.on("update-downloaded", () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.executeJavaScript(`
      if (globalThis.styleElement) globalThis.styleElement.remove();
      `);
    }
    if (mainWindow) {
      mainWindow.setTitle(previousTitle);
    }
    autoUpdater.quitAndInstall(false, true);
    // Put a delay on the install step?  https://github.com/electron-userland/electron-builder/issues/7054#issuecomment-1215289966
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 6000);
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
    nativeWindowOpen: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.on("close", () => {
    remove_watchers(win.id);
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
      ipcMain.handle(key, (event: any, ...args: any) => {
        return val(...args);
      });
    }
  }
  for (const [key, val] of Object.entries(fs.promises)) {
    if (typeof val === "function") {
      ipcMain.handle(key, async (event: any, ...args: any) => {
        return await val(...args);
      });
    }
  }
  ipcMain.handle("isDirectory", async (event: any, ...args: any) => {
    const stats = fs.statSync(...args);
    return stats.isDirectory();
  });
  ipcMain.handle("isFile", async (event: any, ...args: any) => {
    const stats = fs.statSync(...args);
    return stats.isFile();
  });

  session.defaultSession.webRequest.onBeforeSendHeaders(
    filter,
    (details: { requestHeaders: { [x: string]: any } }, callback: (arg0: { requestHeaders: any }) => void) => {
      delete details.requestHeaders["Origin"];
      delete details.requestHeaders["Referer"];
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  session.defaultSession.webRequest.onHeadersReceived(
    filter,
    (details: { responseHeaders: { [x: string]: string[] } }, callback: (arg0: { responseHeaders: any }) => void) => {
      if (details.responseHeaders) {
        details.responseHeaders["Access-Control-Allow-Origin"] = ["*"];
      }
      callback({ responseHeaders: details.responseHeaders });
    }
  );

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
  win.on("close", () => {
    remove_watchers(win.id);
  });

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
  ipcMain.handle("showOpenDialog", async (event: { sender: any }, ...args: any) => {
    const wnd = BrowserWindow.fromWebContents(event.sender);
    return await dialog.showOpenDialog(wnd, ...args);
  });
  ipcMain.handle("showMessageBoxSync", async (event: { sender: any }, ...args: any) => {
    const wnd = BrowserWindow.fromWebContents(event.sender);
    return await dialog.showMessageBoxSync(wnd, ...args);
  });
  ipcMain.handle("getPath", async (event: any, ...args: any) => {
    return await app.getPath(...args);
  });
  ipcMain.handle("closeWindow", async (event: { sender: any }, ...args: any) => {
    const wnd = BrowserWindow.fromWebContents(event.sender);
    return await wnd.close(...args);
  });
  ipcMain.handle("getFolderFiles", async (event: any, ...args: any) => {
    return await getFolderFiles(...args);
  });
  ipcMain.handle("chokidarWatchFile", async (event: { sender: any }, path: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    add_watcher(path, win.id, (_path, stats) => {
      win.webContents.send("fileChanged", path, stats);
    });
  });
  ipcMain.handle("chokidarUnwatchFile", async (event: { sender: any }, path: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    remove_watcher(path, win.id);
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

const { app, BrowserWindow, ipcMain, session, shell, protocol, dialog } = require("electron");
const path = require("path");
const simpleGit = require("simple-git");
const { autoUpdater } = require("electron-updater");
import { add_watcher, remove_watcher, remove_watchers } from "./filewatch";
import { getFile, getFolderFiles } from "./files";
import { entry, options } from "./entry";
import { ProtocolRequest } from "electron";

export function stripHtml(originalString: string): string {
  if (originalString == null) {
    return "";
  }

  let res = originalString.replace(/<br ?[/]?>/g, "\n");
  res = res.replace(/(<([^>]+)>)/gi, "");
  res = res.replace(/&bull;/g, "•");
  res = res.replace(/[&][^;]*;/g, "");
  res = res.replace(/\n */g, "\n");
  res = res.replace(/\n\n*/g, "\n");
  res = res.replace(/−/g, "-");
  return res;
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
        detail: `Changelog:\n${stripHtml(info.releaseNotes)}`,
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
            globalThis.styleElement.setAttribute('id', 'custom-style');
            globalThis.styleElement.textContent = '* { cursor: progress !important; }';
            document.head.appendChild(globalThis.styleElement);
          }`);
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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.on("close", () => {
    remove_watchers(win.id);
  });

  win.loadFile(entry, options);
};
const createMainWindow = () => {
  askForUpdate();

  // Intercept file protocol to fix loading images
  const imageRegex = /(\.png|\.jpg|\.jpeg|\.gif|\.bmp)$/i;
  const cleanDirName = __dirname.replaceAll("\\", "/");
  protocol.interceptFileProtocol(
    "file",
    (request: ProtocolRequest & { path?: string }, callback: (arg0: any) => void) => {
      if (!request.url.match(imageRegex)) {
        callback(request);
        return;
      }

      if (request.url.includes("app.asar")) {
        request.url = request.url.replace(/^[a-zA-Zf:/\\].*?[\/]+assets[\/]+(.*)$/, `${cleanDirName}/assets/$1`);
        callback(request);
        return;
      }
      //  move what comes after /assets to correct path
      if (request.url.includes("/assets/")) {
        const ressource = request.url.replace(/^[a-zA-Zf:/\\].*?[\/]+assets[\/]+(.*)$/, `${cleanDirName}/assets/$1`);
        request.url = ressource.includes("file://") ? ressource : `file://${ressource}`;
        request.path = ressource;
      }
      callback(request);
    }
  );

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
    if (wnd) {
      return await wnd.close(...args);
    }
  });
  ipcMain.handle("getFolderFiles", async (event: any, path: string) => {
    return await getFolderFiles(path);
  });
  ipcMain.handle("getFile", async (event: any, path: string) => {
    return await getFile(path);
  });
  ipcMain.handle("chokidarWatchFile", async (event: { sender: any }, path: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      add_watcher(path, win.id, (_path, stats) => {
        win.webContents.send("fileChanged", path, stats);
      });
    }
  });
  ipcMain.handle("getFolderRemote", async (event: { sender: any }, path: string) => {
    try {
      const git = simpleGit({
        baseDir: path,
      });

      return await git.listRemote(["--get-url", "origin"]);
    } catch (e) {
      return null;
    }
  });
  ipcMain.handle("chokidarUnwatchFile", async (event: { sender: any }, path: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      remove_watcher(path, win.id);
    }
  });

  // Bypass cors
  const filter = { urls: ["https://*/*"] };
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
    (details, callback: (arg0: { responseHeaders: any }) => void) => {
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
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow = win;
  win.on("close", () => {
    remove_watchers(win.id);
  });

  // Use the user's primary browser when opening links
  win.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    console.log("opening url", url);
    if (!url.startsWith("http")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadFile(entry, options);
  previousTitle = win.getTitle();
};
app.whenReady().then(() => {
  if (app.requestSingleInstanceLock()) {
    createMainWindow();
    app.on("second-instance", () => {
      createSecondaryWindow();
    });
  }
});

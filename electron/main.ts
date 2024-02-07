const { app, BrowserWindow, ipcMain, session, shell, protocol, dialog } = require("electron");
const path = require("path");
const simpleGit = require("simple-git");
const { autoUpdater } = require("electron-updater");
const os = require("os")
import * as node_helpers from "./node_helpers";
import * as bs_helpers from "../assets/shared/battlescribe/bs_helpers";
import { add_watcher, remove_watcher, remove_watchers } from "./filewatch";
import { getFile, getFolderFiles } from "./files";
import { entry, options } from "./entry";
import { IpcMainInvokeEvent, ProtocolRequest } from "electron";
import { stripHtml } from "./electron_helpers";
import { useEditorStore } from "~/stores/editorStore";
import { createPinia, setActivePinia } from "pinia";
import { WriteFileOptions, writeFileSync } from "fs";


export function init_globals() {
  const map = {} as Record<string, Function>
  init_handlers((key: string, cb: Function) => {
    map[key] = cb
  })
  globalThis.$node = node_helpers
  globalThis.$helpers = bs_helpers
  globalThis.isEditor = true;
  globalThis.notify = (...args) => console.log(...args);
  globalThis.electron = {
    async send(channel, ...args) {
      return map[channel](null, ...args)
    },
    receive(channel, listener) {
      map[channel] = listener
    },
    async invoke(channel, ...args) {
      return await map[channel](null, ...args)
    },
    on(channel, listener) {
      map[channel] = listener
    }
  }
}
type ListenerCallback = (event: IpcMainInvokeEvent, ...args: any[]) => (Promise<void>) | (any)
export function init_handlers(handle: (channel: string, listener: ListenerCallback) => unknown) {
  // Expose all node functions to invoke
  const fs = require("fs");
  const promiseFunctions = new Set(Object.keys(fs.promises));
  for (const [key, val] of Object.entries(fs)) {
    if (promiseFunctions.has(key)) continue;
    if (typeof val === "function") {
      handle(key, (event: null | any, ...args: any) => {
        return val(...args);
      });
    }
  }
  for (const [key, val] of Object.entries(fs.promises)) {
    if (typeof val === "function") {
      handle(key, async (event: null | any, ...args: any) => {
        return await val(...args);
      });
    }
  }
  handle("isDirectory", async (event: null | any, ...args: any) => {
    const stats = fs.statSync(...args);
    return stats.isDirectory();
  });
  handle("isFile", async (event: null | any, ...args: any) => {
    const stats = fs.statSync(...args);
    return stats.isFile();
  });
  handle("showOpenDialog", async (event: null | { sender: Electron.WebContents; }, ...args: any[]) => {
    if (event) {
      const wnd = BrowserWindow.fromWebContents(event.sender);
      //@ts-ignore
      return await dialog.showOpenDialog(wnd, ...args);
    }
  });
  handle("showMessageBoxSync", async (event: null | { sender: Electron.WebContents; }, ...args: any[]) => {
    if (event) {
      const wnd = BrowserWindow.fromWebContents(event.sender);
      //@ts-ignore
      return dialog.showMessageBoxSync(wnd, ...args);
    }
  });
  handle("getPath", async (event: null | any, ...args: any) => {
    //@ts-ignore
    return await app.getPath(...args);
  });
  handle("closeWindow", async (event: null | { sender: Electron.WebContents; }, ...args: any) => {
    if (event) {
      const wnd = BrowserWindow.fromWebContents(event.sender);
      if (wnd) {
        //@ts-ignore
        return await wnd.close(...args);
      }
    }
  });
  handle("getFolderFiles", async (event: null | any, path: any) => {
    return await getFolderFiles(path);
  });
  handle("getFile", async (event: null | any, path: any) => {
    return await getFile(path);
  });
  handle("saveFile", async (event: null | any, path: any, data: any, options?: WriteFileOptions) => {
    if (typeof data === "string" && os.platform.includes('win')) {
      data = data.replace(/\n/g, "\r\n")
    }
    return await writeFileSync(path, data, options);
  });
  handle("chokidarWatchFile", async (event: null | { sender: Electron.WebContents; }, path: string) => {
    if (event) {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        add_watcher(path, win.id, (_path, stats) => {
          win.webContents.send("fileChanged", path, stats);
        });
      }
    }
  });
  handle("getFolderRemote", async (event: null | any, path: any) => {
    try {
      const git = simpleGit({
        baseDir: path,
      });

      return await git.listRemote(["--get-url", "origin"]);
    } catch (e) {
      return null;
    }
  });
  handle("chokidarUnwatchFile", async (event: null | { sender: Electron.WebContents; }, path: string) => {
    if (event) {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        remove_watcher(path, win.id);
      }
    }
  });
}

// Initialize handlers so that browser functions can be run from node
init_globals()
init_handlers(ipcMain.handle)



// async function test() {
//   const pinia = createPinia()
//   setActivePinia(pinia)
//   const store = useEditorStore()
//   await store.load_systems_from_folder("C:/Users/Nathan/BattleScribe/data/Warhammer-The-Old-World",
//     (c, m, msg) => console.log(`${c}/${m}: ${msg}`)
//   )
//   const { system, catalogue } = await store.open_catalogue("sys-31d1-bf57-53ea-ad55")
//   const search = await store.system_search(system, { filter: "gun" })
//   const found = await store.update_catalogue_search(catalogue, { filter: "gun", ignoreProfilesRules: false })
//   // console.log("Found", search?.all.length, "results", search?.all.map(o => o.toString()));
//   console.log("Found", found.length, "results", found.map(o => o.toString()));
// }
// test()
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

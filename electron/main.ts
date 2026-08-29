const { app, BrowserWindow, ipcMain, session, shell, protocol, dialog, net } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

// On Linux the chrome-sandbox helper must be root-owned with mode 4755, which
// isn't the case for a plain `npm install` (especially on external drives).
// Disable the sandbox here so `npm run electron` works out of the box.
if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
}

const simpleGit = require("simple-git");
const { autoUpdater } = require("electron-updater");
const os = require("os")
import * as node_helpers from "./node_helpers";
import * as bs_helpers from "../assets/shared/battlescribe/bs_helpers";
import { add_watcher, mark_self_write, remove_watcher, remove_watchers } from "./filewatch";
import { getFile, getFolderFiles, getFolderFolders, getFolderMtime, listFolder } from "./files";
import { entry, options } from "./entry";
import type { IpcMainInvokeEvent } from "electron";
import { stripHtml } from "./electron_helpers";
import { readFileSync, writeFileSync } from "fs";
import type { WriteFileOptions } from "fs";


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
    try {
      const stats = fs.statSync(...args);
      return stats.isDirectory();
    } catch {
      return false;
    }
  });
  handle("isFile", async (event: null | any, ...args: any) => {
    try {
      const stats = fs.statSync(...args);
      return stats.isFile();
    } catch {
      return false;
    }
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
  handle("getFolderFiles", async (event: null | any, path: any, depth: number, skip?: string[]) => {
    return await getFolderFiles(path, depth, skip);
  });
  handle("listFolder", async (event: null | any, path: any, depth: number, skip?: string[]) => {
    return await listFolder(path, depth, skip);
  });
  handle("getFolderFolders", async (event: null | any, path: any) => {
    return await getFolderFolders(path);
  });
  handle("getFile", async (event: null | any, path: any) => {
    return await getFile(path);
  });
  handle("getFolderMtime", async (event: null | any, path: any) => {
    return await getFolderMtime(path);
  });
  handle("saveFile", async (event: null | any, path: any, data: any, options?: WriteFileOptions) => {
    if (typeof data === "string" && os.platform().includes('win')) {
      data = data.replace(/\n/g, "\r\n")
    }
    const result = writeFileSync(path, data, options);
    // the watcher is about to see this write: tell it the change came from us
    mark_self_write(path);
    return result;
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

let mainWindow: Electron.BrowserWindow | null = null;
let previousTitle = "";
function setupUpdater() {
  // electron-updater emits "error"; with no listener node throws it as an unhandled error
  autoUpdater.on("error", (e: Error) => console.error("updater:", e));
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
          // taken here, not at startup: right after load the window still has its default title
          previousTitle = mainWindow ? mainWindow.getTitle() : "";
          // User clicked 'Install', start downloading and installing the update
          autoUpdater.downloadUpdate();
        }
      });
  });
  autoUpdater.on(
    "download-progress",
    (progress: { bytesPerSecond: string; percent: string | number; transferred: string; total: string }) => {
      try {
        if (mainWindow) {
          mainWindow.webContents.executeJavaScript(`
          if (!globalThis.styleElement){
            globalThis.styleElement = document.createElement('style');
            globalThis.styleElement.setAttribute('id', 'custom-style');
            globalThis.styleElement.textContent = '* { cursor: progress !important; }';
            document.head.appendChild(globalThis.styleElement);
          }`);
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
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
      if (globalThis.styleElement) globalThis.styleElement.remove();
      `);
      mainWindow.setProgressBar(-1);
      mainWindow.setTitle(previousTitle);
    }
    // quitAndInstall goes through app.quit(), which the unsaved-changes prompt can cancel;
    // autoInstallOnAppQuit below then installs it on the next normal quit instead of losing it.
    autoUpdater.quitAndInstall(true, true);
  });

  autoUpdater.autoDownload = false;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.checkForUpdates().catch((e: Error) => console.error("updater:", e));
}

// One-time session setup; running it per window would fail the protocol intercept and stack the header hooks.
function setupSession() {
  // Remap image requests so `assets/...` resolves next to the app instead of against
  // whatever directory the current route made the renderer guess.
  //
  // This used protocol.interceptFileProtocol. Electron 44 still exposes it, but it no
  // longer passes requests through: it swallowed index.html itself and the window came
  // up blank (39 characters of document). protocol.handle is the supported replacement;
  // net.fetch needs bypassCustomProtocolHandlers so it does not re-enter this handler.
  const imageRegex = /(\.png|\.jpg|\.jpeg|\.gif|\.bmp)$/i;
  const cleanDirName = __dirname.replaceAll("\\", "/");
  protocol.handle("file", (request: { url: string }) => {
    let url = request.url;
    if (imageRegex.test(url)) {
      const remapped = url.replace(/^[a-zA-Zf:/\\].*?[\/]+assets[\/]+(.*)$/, `${cleanDirName}/assets/$1`);
      if (remapped !== url) {
        url = remapped.includes("file://") ? remapped : pathToFileURL(remapped).toString();
      }
    }
    return net.fetch(url, { bypassCustomProtocolHandlers: true });
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
}

function restoreBounds(win: Electron.BrowserWindow, iniPath: string) {
  try {
    const saved = JSON.parse(readFileSync(iniPath, { encoding: "utf-8" }));
    // a position saved on a monitor that is no longer plugged in would open the window offscreen,
    // which looks exactly like a running app with no window
    const area = require("electron").screen.getDisplayMatching(saved).workArea;
    const onScreen =
      saved.x < area.x + area.width &&
      saved.x + saved.width > area.x &&
      saved.y < area.y + area.height &&
      saved.y + saved.height > area.y;
    if (onScreen) win.setBounds(saved);
    if (saved.maximized) win.maximize();
  } catch (e) {
    // no saved bounds (or unreadable): keep the constructor defaults
  }
}

const createWindow = () => {
  const iniPath = `${app.getPath("userData")}/ini.json`;
  const win: Electron.BrowserWindow = new BrowserWindow({
    autoHideMenuBar: true,
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  const id = win.id;

  restoreBounds(win, iniPath);

  win.on("close", () => {
    try {
      // getNormalBounds, or maximizing once would permanently save the maximized size as the restored size
      writeFileSync(iniPath, JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
    } catch (e) {
      console.error(e);
    }
  });
  // "close" also fires when the renderer cancels the close (unsaved changes), which would kill
  // file watching on a window that is still open, so drop the watchers only once it is really gone.
  win.on("closed", () => {
    remove_watchers(id);
    if (mainWindow === win) mainWindow = null;
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
  return win;
};

// Losing the lock used to fall through to nothing: the extra process stayed alive with no window,
// holding the installed files so the updater could not replace them until every one was killed.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = mainWindow ?? BrowserWindow.getAllWindows()[0];
    if (!win) {
      mainWindow = createWindow();
      return;
    }
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) mainWindow = createWindow();
  });

  app.whenReady().then(() => {
    setupSession();
    mainWindow = createWindow();
    setupUpdater();
  });
}

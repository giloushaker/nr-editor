import type { Stats } from "fs";
import type { OpenDialogOptions, OpenDialogReturnValue, MessageBoxSyncOptions } from "electron";
import * as web_fs from "./web_fs";
export function dirname(path: string) {
  return path.replaceAll("\\", "/").split("/").slice(0, -1).join("/");
}
export function filename(path: string) {
  const split = path.replaceAll("\\", "/").split("/");
  return split[split.length - 1];
}
export async function getFolderFiles(folderPath: string, depth = 0, skip?: string[]) {
  if (!electron) return web_fs.getFolderFiles(folderPath, depth, skip);
  return (await electron.invoke("getFolderFiles", folderPath, depth, skip)) as Array<{
    name: string;
    path: string;
    data: string;
  }>;
}
export async function listFolder(folderPath: string, depth = 0, skip?: string[]) {
  if (!electron) return web_fs.listFolder(folderPath, depth, skip);
  return (await electron.invoke("listFolder", folderPath, depth, skip)) as Array<{
    name: string;
    path: string;
    directory: boolean;
  }>;
}
export async function getFolderFolders(folderPath: string) {
  if (!electron) return web_fs.getFolderFolders(folderPath);
  return (await electron.invoke("getFolderFolders", folderPath)) as Array<{ name: string; path: string }>;
}

export async function isDirectory(path: string) {
  if (!electron) return false;
  return (await electron.invoke("isDirectory", path)) as boolean;
}
export async function getFolderMtime(folderPath: string): Promise<number | undefined> {
  if (!electron) return web_fs.getFolderMtime(folderPath);
  return (await electron.invoke("getFolderMtime", folderPath)) as number | undefined;
}
export async function writeFile(filePath: string, data: string | Blob | Buffer | Uint8Array) {
  if (!electron) return web_fs.writeFile(filePath, data as string | Blob | Uint8Array);
  const dirPath = dirname(filePath);
  await electron.invoke("mkdirSync", dirPath, { recursive: true });
  await electron.invoke("saveFile", filePath, data);
}
export async function deleteFile(filePath: string) {
  if (!electron) return web_fs.deleteFile(filePath);
  return await electron.invoke("unlinkSync", filePath);
}
export async function readFile(filePath: string) {
  if (!electron) return web_fs.readFile(filePath);
  return (await electron.invoke("getFile", filePath)) as {
    name: string;
    path: string;
    data: string;
  };
}
export async function showOpenDialog(options: OpenDialogOptions) {
  if (!electron) return;
  return electron.invoke("showOpenDialog", options) as OpenDialogReturnValue;
}
export async function showMessageBox(options: MessageBoxSyncOptions) {
  if (!electron) return;
  return electron.invoke("showMessageBoxSync", options) as number;
}
export async function closeWindow() {
  if (!electron) return;
  return electron.invoke("closeWindow");
}
export async function getPath(
  name:
    | "home"
    | "appData"
    | "userData"
    | "sessionData"
    | "temp"
    | "exe"
    | "module"
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos"
    | "recent"
    | "logs"
    | "crashDumps"
) {
  if (!electron) return;
  return (await electron.invoke("getPath", name)) as string;
}
export async function createFolder(dirPath: string) {
  if (!electron) return web_fs.createFolder(dirPath);
  await electron.invoke("mkdirSync", dirPath, { recursive: true });
}
let initialized = false;
const watchers = {} as Record<string, (path: string, stats: Stats) => unknown>;
export async function watchFile(path: string, callback: (path: string, stats: Stats) => unknown) {
  if (!electron) return web_fs.watchFile(path, callback as (path: string) => unknown);
  if (!initialized) {
    initialized = true;
    electron.on("fileChanged", (_: any, _path: string, _stats: Stats) => {
      const cb = watchers[_path.replaceAll("\\", "/")];
      cb && cb(_path, _stats);
    });
  }
  // the main process keys watchers by forward-slash path; same spelling here or the callback never fires
  path = path.replaceAll("\\", "/");
  await electron.invoke("chokidarWatchFile", path);
  watchers[path] = callback;
}
export async function unwatchFile(path: string) {
  if (!electron) return web_fs.unwatchFile(path);
  path = path.replaceAll("\\", "/");
  delete watchers[path];
  await electron.invoke("chokidarUnwatchFile", path);
}

/**
 * Opens a file with whatever the OS uses for it. Electron only -- a browser cannot, so callers
 * check the return and say so rather than appearing to do nothing.
 */
export async function openPath(filePath: string): Promise<boolean> {
  if (!electron) return false;
  const error = (await electron.invoke("openPath", filePath)) as string;
  if (error) throw new Error(error);
  return true;
}

export async function getFolderRemote(path: string): Promise<string | null> {
  if (!electron) return null;
  return (await electron.invoke("getFolderRemote", path)) as string | null;
}

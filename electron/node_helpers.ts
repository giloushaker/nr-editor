import type { Stats, writeFileSync } from "fs";
import { isZipExtension } from "~/assets/shared/battlescribe/bs_convert";

export function dirname(path: string) {
  return path.replaceAll("\\", "/").split("/").slice(0, -1).join("/");
}
export function filename(path: string) {
  const split = path.replaceAll("\\", "/").split("/");
  return split[split.length - 1];
}
export async function getFolderFiles(folderPath: string) {
  if (!electron) return;
  try {
    const fileObjects = [];
    const isPathFile = (await electron.invoke("isFile", folderPath)) as boolean;
    if (isPathFile) {
      folderPath = dirname(folderPath);
    }

    const entries = (await electron.invoke("readdirSync", folderPath)) as string[];

    for (const entry of entries) {
      const filePath = `${folderPath}/${entry}`;

      try {
        const isFile = (await electron.invoke("isFile", filePath)) as boolean;
        if (isFile) {
          const data = await electron.invoke("readFileSync", filePath, isZipExtension(entry) ? undefined : "utf-8");
          const fileObject = {
            name: entry,
            data: data,
            path: filePath,
          };
          fileObjects.push(fileObject);
        }
      } catch (error) {
        console.error("Error reading file:", filePath, error);
        continue;
      }
    }

    return fileObjects;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}
export async function getFolderFolders(folderPath: string) {
  if (!electron) return;
  try {
    const fileObjects = [];
    const pathIsDir = (await electron.invoke("isDirectory", folderPath)) as boolean;
    if (!pathIsDir) return [];

    const entries = (await electron.invoke("readdirSync", folderPath)) as string[];

    for (const entry of entries) {
      const filePath = `${folderPath}/${entry}`;

      try {
        const isDir = (await electron.invoke("isDirectory", filePath)) as boolean;
        if (isDir) {
          const fileObject = {
            name: entry,
            path: filePath,
          };
          fileObjects.push(fileObject);
        }
      } catch (error) {
        console.error("Error reading dir:", filePath, error);
        continue;
      }
    }

    return fileObjects;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

export async function writeFile(filePath: string, data: string | Blob | Buffer | Uint8Array) {
  if (!electron) return;
  const dirPath = dirname(filePath);
  await electron.invoke("mkdirSync", dirPath, { recursive: true });
  await electron.invoke("writeFileSync", filePath, data);
}
export async function showOpenDialog(options: Electron.OpenDialogOptions) {
  if (!electron) return;
  return electron.invoke("showOpenDialog", options) as Electron.OpenDialogReturnValue;
}
export async function showMessageBox(options: Electron.MessageBoxSyncOptions) {
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
  if (!electron) return;
  await electron.invoke("mkdirSync", dirPath, { recursive: true });
}

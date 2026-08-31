// File System Access API backend (Chrome/Edge) mirroring the electron IPC helpers.
// Paths are virtual: "<pickedFolderName>/sub/dir/file.cat" — the first segment is the
// name of a folder (or single file) the user picked, whose handle is persisted in Dexie.
import { db } from "~/assets/shared/battlescribe/cataloguesdexie";
import { isZipExtension, unzipFile, isAllowedExtension } from "~/assets/shared/battlescribe/bs_convert";

type AnyHandle = FileSystemDirectoryHandle | FileSystemFileHandle;

const roots = new Map<string, AnyHandle>();
let restored: Promise<void> | null = null;

export function supported() {
  return typeof (globalThis as any).showDirectoryPicker === "function";
}

export function restoreHandles() {
  if (!restored) {
    restored = (async () => {
      try {
        for (const row of await db.handles.toArray()) {
          roots.set(row.id, row.handle);
        }
      } catch (e) {
        console.error("Failed to restore folder handles", e);
      }
    })();
  }
  return restored;
}

function rootOf(path: string) {
  return path.replaceAll("\\", "/").split("/").filter(Boolean)[0];
}

export async function hasRoot(path: string) {
  if (!supported() || !path) return false;
  await restoreHandles();
  return roots.has(rootOf(path));
}

async function verifyPermission(handle: AnyHandle, request = true) {
  const h = handle as any;
  if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
  if (!request) return false;
  return (await h.requestPermission({ mode: "readwrite" })) === "granted";
}

export async function permissionState(path: string): Promise<"granted" | "prompt" | "missing"> {
  await restoreHandles();
  const handle = roots.get(rootOf(path)) as any;
  if (!handle) return "missing";
  return await handle.queryPermission({ mode: "readwrite" });
}

// Must be called from a user gesture if permission was not previously granted.
export async function requestPermission(path: string) {
  await restoreHandles();
  const handle = roots.get(rootOf(path));
  return handle ? await verifyPermission(handle) : false;
}

export async function pickFolder(): Promise<string | undefined> {
  const handle: FileSystemDirectoryHandle = await (globalThis as any).showDirectoryPicker({ mode: "readwrite" });
  if (!handle) return;
  roots.set(handle.name, handle);
  await db.handles.put({ id: handle.name, handle });
  return handle.name;
}

async function readFileData(file: File): Promise<string> {
  return isZipExtension(file.name) ? await unzipFile(await file.arrayBuffer()) : await file.text();
}

// Picks individual files; their handles are registered as roots so saving back works.
export async function pickFiles(): Promise<Array<{ name: string; path: string; data: string }>> {
  const handles: FileSystemFileHandle[] = await (globalThis as any).showOpenFilePicker({ multiple: true });
  const result = [];
  for (const handle of handles || []) {
    roots.set(handle.name, handle);
    await db.handles.put({ id: handle.name, handle });
    const file = await handle.getFile();
    result.push({ name: file.name, path: handle.name, data: await readFileData(file) });
  }
  return result;
}

// Resolves a virtual path to a directory handle, walking (and optionally creating) subfolders.
async function resolveFolder(path: string, create = false, request = true) {
  await restoreHandles();
  const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
  const root = roots.get(parts[0]);
  if (!root || root.kind !== "directory") {
    throw new Error(`No folder access for "${parts[0]}", use Set Working Folder to grant it`);
  }
  if (!(await verifyPermission(root, request))) {
    throw new Error(`Permission denied for folder "${parts[0]}"`);
  }
  let dir = root as FileSystemDirectoryHandle;
  for (const part of parts.slice(1)) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir;
}

async function resolveFile(path: string, create = false, request = true) {
  const direct = roots.get(rootOf(path));
  if (direct?.kind === "file") {
    if (!(await verifyPermission(direct, request))) {
      throw new Error(`Permission denied for file "${path}"`);
    }
    return direct;
  }
  const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
  const dir = await resolveFolder(parts.slice(0, -1).join("/"), create, request);
  return await dir.getFileHandle(parts[parts.length - 1], { create });
}

export async function readFile(path: string) {
  const handle = await resolveFile(path);
  const file = await handle.getFile();
  return { name: file.name, path, data: await readFileData(file) };
}

export async function writeFile(path: string, data: string | Blob | Uint8Array) {
  const handle = await resolveFile(path, true);
  const writable = await (handle as any).createWritable();
  await writable.write(data);
  await writable.close();
  // same idea as the electron side: keep the poller from reporting our own write as an external change
  if (watchers.has(path)) lastModified.set(path, (await handle.getFile()).lastModified);
}

export async function deleteFile(path: string) {
  const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
  const dir = await resolveFolder(parts.slice(0, -1).join("/"));
  await dir.removeEntry(parts[parts.length - 1]);
}

export async function createFolder(path: string) {
  await resolveFolder(path, true);
}

export async function listFolder(folderPath: string, depth = 0, skip?: string[]) {
  const dir = await resolveFolder(folderPath);
  const result = [] as Array<{ name: string; path: string; directory: boolean }>;
  const walk = async (d: FileSystemDirectoryHandle, base: string, level: number) => {
    for await (const entry of (d as any).values()) {
      if (skip?.includes(entry.name)) continue;
      const directory = entry.kind === "directory";
      result.push({ name: entry.name, path: `${base}/${entry.name}`, directory });
      if (directory && level < depth) await walk(entry, `${base}/${entry.name}`, level + 1);
    }
  };
  await walk(dir, folderPath.replaceAll("\\", "/").split("/").filter(Boolean).join("/"), 0);
  return result;
}

export async function getFolderFolders(folderPath: string) {
  const dir = await resolveFolder(folderPath);
  const base = folderPath.replaceAll("\\", "/").split("/").filter(Boolean).join("/");
  const result = [] as Array<{ name: string; path: string }>;
  for await (const entry of (dir as any).values()) {
    if (entry.kind === "directory") {
      result.push({ name: entry.name, path: `${base}/${entry.name}` });
    }
  }
  return result;
}

// newest file lastModified in a folder tree (no content reads), skipping git folders
export async function getFolderMtime(folderPath: string): Promise<number | undefined> {
  try {
    const dir = await resolveFolder(folderPath, false, false);
    let max = 0;
    const walk = async (d: FileSystemDirectoryHandle) => {
      for await (const entry of (d as any).values()) {
        if (entry.name === ".git" || entry.name === ".github") continue;
        if (entry.kind === "file") {
          const file = await entry.getFile();
          if (file.lastModified > max) max = file.lastModified;
        } else {
          await walk(entry);
        }
      }
    };
    await walk(dir);
    return max || undefined;
  } catch {
    return undefined;
  }
}

export async function getFolderFiles(folderPath: string, depth = 0, skip?: string[]) {
  const entries = await listFolder(folderPath, depth, skip);
  const result = [] as Array<{ name: string; path: string; data: string }>;
  for (const entry of entries) {
    if (entry.directory || !isAllowedExtension(entry.name)) continue;
    const handle = await resolveFile(entry.path);
    result.push({ name: entry.name, path: entry.path, data: await readFileData(await handle.getFile()) });
  }
  return result;
}

// ponytail: 5s lastModified polling — no native watch API in browsers; move to FileSystemObserver when it ships
const watchers = new Map<string, (path: string) => unknown>();
const lastModified = new Map<string, number>();
let pollTimer: ReturnType<typeof setInterval> | undefined;

async function poll() {
  for (const [path, callback] of watchers) {
    try {
      const handle = await resolveFile(path, false, false);
      const file = await handle.getFile();
      const prev = lastModified.get(path);
      lastModified.set(path, file.lastModified);
      if (prev !== undefined && file.lastModified > prev) {
        callback(path);
      }
    } catch {
      // no permission yet / file gone: ignore
    }
  }
}

export async function watchFile(path: string, callback: (path: string) => unknown) {
  if (!(await hasRoot(path))) return;
  watchers.set(path, callback);
  if (!pollTimer) pollTimer = setInterval(poll, 5000);
}

export function unwatchFile(path: string) {
  watchers.delete(path);
  lastModified.delete(path);
}

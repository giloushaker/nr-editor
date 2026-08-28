const { readFile, readdir, stat } = require("fs/promises");
import { isAllowedExtension, isZipExtension } from "../assets/shared/battlescribe/bs_convert";

function replaceSlashes(path: string) {
  return path.replace(/\\/g, "/");
}
function filename(path: string) {
  return replaceSlashes(path).split("/").pop();
}
function dirname(path: string) {
  return replaceSlashes(path).split("/").slice(0, -1).join("/");
}
export async function isFile(f: any) {
  const stats = await stat(f);
  return stats.isFile();
}

// newest file mtime in a folder tree (no content reads), skipping git folders
export async function getFolderMtime(folderPath: string): Promise<number | undefined> {
  let max = 0;
  const stack = [folderPath];
  while (stack.length) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === ".github") continue;
      const path = `${current}/${entry.name}`;
      if (entry.isDirectory()) {
        stack.push(path);
      } else {
        try {
          const stats = await stat(path);
          if (stats.mtimeMs > max) max = stats.mtimeMs;
        } catch {}
      }
    }
  }
  return max || undefined;
}

var AdmZip = require("adm-zip");
export async function readAndUnzipFile(path: string) {
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

export async function getFile(filePath: any) {
  return await readAndUnzipFile(filePath).then((data) => ({ data, name: filename(filePath), path: filePath }));
}

// Listing only: no reads, no extension filter. getFolderFiles is the batch loader that
// wants every catalogue's content in one round trip; anything else wants names.
export async function listFolder(folderPath: string, depth = 0, skip?: string[]) {
  const toSkip = new Set(skip ?? []);
  const result = [] as Array<{ name: string; path: string; directory: boolean }>;
  const stack = [{ path: replaceSlashes(folderPath), level: 0 }];
  while (stack.length) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await readdir(current.path, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = `${current.path}/${entry.name}`;
      const directory = entry.isDirectory();
      if (directory && current.level < depth && !toSkip.has(entry.name)) {
        stack.push({ path, level: current.level + 1 });
      }
      result.push({ name: entry.name, path, directory });
    }
  }
  return result;
}

export async function getFolderFolders(folderPath: string) {
  const entries = await listFolder(folderPath);
  return entries.filter((entry) => entry.directory).map(({ name, path }) => ({ name, path }));
}

export async function getFolderFiles(folderPath: any, depth = 0, skip?: string[]) {
  if (await isFile(folderPath)) folderPath = dirname(folderPath);
  const entries = await listFolder(folderPath, depth, skip);
  const files = entries
    // reading a nested pdf or zip just to drop it later costs the whole file in memory
    .filter((entry) => !entry.directory && isAllowedExtension(entry.name))
    .map((entry) => readAndUnzipFile(entry.path).then((data) => ({ data, name: entry.name, path: entry.path })));
  return (await Promise.all(files)).filter((o) => o.data);
}

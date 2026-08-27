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
export async function listFolder(folderPath: string, recursive = false, skip?: string[]) {
  const toSkip = new Set(skip ?? []);
  const result = [] as Array<{ name: string; path: string; directory: boolean }>;
  const stack = [replaceSlashes(folderPath)];
  while (stack.length) {
    const curPath = stack.pop()!;
    let entries;
    try {
      entries = await readdir(curPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = `${curPath}/${entry.name}`;
      const directory = entry.isDirectory();
      if (directory && recursive && !toSkip.has(entry.name)) stack.push(path);
      result.push({ name: entry.name, path, directory });
    }
  }
  return result;
}

export async function getFolderFolders(folderPath: string) {
  const entries = await listFolder(folderPath);
  return entries.filter((entry) => entry.directory).map(({ name, path }) => ({ name, path }));
}

export async function getFolderFiles(folderPath: any, recursive = false, skip?: string[]) {
  const toSkip = new Set(skip ?? [])
  const fileObjects = [];
  const isPathFile = await isFile(folderPath);
  if (isPathFile) {
    folderPath = dirname(folderPath);
  }


  const stack = [folderPath]
  while (stack.length) {
    const curPath = stack.pop();
    const entries = await readdir(curPath, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = `${curPath}/${entry.name}`;
      if (entry.isDirectory()) {
        if (recursive && !toSkip?.has(entry.name)) stack.push(filePath)
      } else {
        fileObjects.push(readAndUnzipFile(filePath).then((data) => ({ data, name: entry.name, path: filePath })));
      }
    }
  }

  return (await Promise.all(fileObjects)).filter((o) => o.data);
}

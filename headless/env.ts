/**
 * Boots the real editor -- its Pinia store, the catalogue_editor grafts, diagnostics, reference
 * index -- in plain Node, with no window.
 *
 * The renderer only ever reaches the disk through `globalThis.electron.invoke(channel, ...)`, so
 * answering those channels here with the same functions electron/main.ts registers (electron/files
 * plus node's fs) is all it takes for the store to load and save exactly as the desktop app does.
 * Same idea as init_globals() in electron/main.ts, minus the parts that need Electron itself.
 *
 * Everything the editor prints goes to stderr: stdout is the tool result, and a caller parsing it
 * must not get "Loading 19 files" in the middle.
 */
import * as fs from "node:fs";
import { dirname, resolve } from "node:path";
import { toRaw, markRaw, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import * as files from "~/electron/files";
import * as helpers from "~/assets/shared/battlescribe/bs_helpers";
import * as node from "~/electron/node_helpers";
import type { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { db as cataloguesdb } from "~/assets/shared/battlescribe/cataloguesdexie";

const quiet = (...args: unknown[]) => console.error(...args);
console.log = quiet;
console.info = quiet;
console.warn = quiet;
console.debug = () => undefined;

const handlers: Record<string, (...args: any[]) => unknown> = {
  getFolderFiles: files.getFolderFiles,
  listFolder: files.listFolder,
  getFolderFolders: files.getFolderFolders,
  getFile: files.getFile,
  getFolderMtime: files.getFolderMtime,
  isDirectory: (path: string) => fs.existsSync(path) && fs.statSync(path).isDirectory(),
  isFile: (path: string) => fs.existsSync(path) && fs.statSync(path).isFile(),
  saveFile: (path: string, data: string | Uint8Array) => fs.writeFileSync(path, data),
  // Nothing to watch without a window to tell, and no git integration to offer.
  chokidarWatchFile: () => undefined,
  chokidarUnwatchFile: () => undefined,
  getFolderRemote: () => null,
};

(globalThis as any).electron = {
  async invoke(channel: string, ...args: unknown[]) {
    const handler = handlers[channel] ?? (fs as any)[channel];
    if (typeof handler !== "function") throw new Error(`headless: no handler for "${channel}"`);
    return await handler(...args);
  },
  send() {},
  receive() {},
  on() {},
};
Object.assign(globalThis, {
  $toRaw: toRaw,
  $markRaw: markRaw,
  $nextTick: nextTick,
  $helpers: helpers,
  $node: node,
  isEditor: true,
  notify: (...args: unknown[]) => console.error("[notify]", ...args),
});

/**
 * The browser cache (IndexedDB through Dexie) does not exist here, and every system comes from
 * disk, so each table answers as an empty one would. Without this, a catalogueLink to a file the
 * folder lacks died on "IndexedDB API missing" instead of the editor's own "Couldn't import".
 */
function emptyQuery(): unknown {
  const answers: Record<string, unknown> = {
    toArray: async () => [],
    get: async () => undefined,
    first: async () => undefined,
    last: async () => undefined,
    count: async () => 0,
    put: async () => undefined,
    bulkPut: async () => undefined,
    add: async () => undefined,
    delete: async () => undefined,
    clear: async () => undefined,
    each: async () => undefined,
    then: undefined,
  };
  const query: unknown = new Proxy({}, {
    get: (_, key) => (typeof key === "string" && key in answers ? answers[key] : () => query),
  });
  return query;
}
for (const table of ["catalogues", "systems", "systemrows", "handles"]) {
  Object.defineProperty(cataloguesdb, table, { value: emptyQuery(), configurable: true });
}

setActivePinia(createPinia());
const { useEditorStore } = await import("~/stores/editorStore");
const { useSettingsStore } = await import("~/stores/settingsState");

export const store = useEditorStore();
(globalThis as any).$store = store;

/** A file that makes a folder a system: what the editor's folder loader would pick up as one. */
const SYSTEM_FILE = /\.(gst|gstz)$|\.gamesystem\.json$|\.gst\.json$/i;

function holdsSystem(folder: string): boolean {
  try {
    return fs.readdirSync(folder).some((name) => SYSTEM_FILE.test(name));
  } catch {
    return false;
  }
}

/** --system, then $NR_SYSTEM, then the working folder or the nearest parent holding a system file. */
export function findSystemFolder(given?: string): string {
  const explicit = given ?? process.env.NR_SYSTEM;
  if (explicit) {
    const folder = resolve(explicit);
    if (!fs.existsSync(folder)) throw new Error(`No such folder: ${folder}`);
    return fs.statSync(folder).isFile() ? dirname(folder) : folder;
  }
  for (let folder = process.cwd(); ; folder = dirname(folder)) {
    if (holdsSystem(folder)) return folder;
    if (dirname(folder) === folder) break;
  }
  throw new Error("No game system here: pass --system <folder> or set NR_SYSTEM.");
}

/** Loads every file of the folder's system and processes it for the editor, as opening it does. */
export async function loadSystem(folder: string): Promise<GameSystemFiles> {
  // Some tools list "the working folder" (nr_systems); point it at where the system lives.
  useSettingsStore().systemsFolder = dirname(folder);
  const ids = await store.load_systems_from_folder(folder);
  if (!ids?.length) throw new Error(`No game system file found in ${folder}`);
  if (ids.length > 1) throw new Error(`${folder} holds ${ids.length} game systems; point --system at one of them.`);
  const system = store.gameSystems[ids[0]];
  await system.loadAll();
  return system;
}

// A system's icons as files beside its .gst (icons/<kind>/<id>.<ext>), the convention NR reads: see
// assets/shared/battlescribe/icons.ts. The editor only writes files at the default path, never the `icon`
// attribute, so a schema-checked (BSData) repo stays valid.
import { reactive } from "vue";
import { assetMime, iconKey, iconPath, isAssetPath, scanIconPaths, type IconPaths } from "~/assets/shared/battlescribe/icons";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import type { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { deleteFile, dirname, listFolder, readFile, readFileBytes, writeFile } from "~/electron/node_helpers";
import { permissionState, requestPermission } from "~/electron/web_fs";

/** What the editor accepts after conversion: NR stores every icon of an install for offline use. */
export const ICON_MAX_BYTES = 100 * 1024;
/** Longest side of a converted image; NR draws icons at 20-40px. */
const ICON_MAX_SIDE = 256;

/** Where a new file goes, per kind. system and weapon are single files directly in icons/. */
const KIND_FOLDER: Record<string, string> = { category: "categories", force: "forces", army: "factions" };

/** One thing that takes an icon, and the keys NR tries for it, in its order. */
export interface IconTarget {
  kind: string;
  label: string;
  keys: string[];
  /** The node's own `icon` attribute (repos NR owns), which wins over files in NR */
  icon?: string;
}

export interface SystemIcons {
  folder: string;
  /** Every image under icons/, relative to the .gst folder */
  files: string[];
  paths: IconPaths;
  /** relative path -> object url */
  urls: Record<string, string>;
  loaded: boolean;
  error: string;
}

/** The folder holding the .gst, and whether the editor may write there: "prompt" is a web folder whose access
 * lapsed with a reload (one click grants it), "missing" a system not opened from a folder at all. */
export async function iconFolder(system: GameSystemFiles | undefined): Promise<{ folder: string | null; access: "granted" | "prompt" | "missing" }> {
  const path = system?.gameSystem?.gameSystem?.fullFilePath;
  if (!path) return { folder: null, access: "missing" };
  const folder = dirname(path);
  if (globalThis.electron) return { folder, access: "granted" };
  const access = await permissionState(folder);
  return { folder, access: access === "granted" ? "granted" : access === "missing" ? "missing" : "prompt" };
}

/** Asks for readwrite on the folder; must run from a click. */
export async function grantFolder(folder: string): Promise<boolean> {
  const ok = await requestPermission(folder);
  const state = states.get(folder);
  if (ok && state) await refreshIcons(state);
  return ok;
}

const states = new Map<string, SystemIcons>();

/** One shared state per folder, so the icons page and the right panel show the same files. */
export function systemIcons(folder: string): SystemIcons {
  let state = states.get(folder);
  if (!state) {
    state = reactive({ folder, files: [], paths: {}, urls: {}, loaded: false, error: "" }) as SystemIcons;
    states.set(folder, state);
    void refreshIcons(state);
  }
  return state;
}

function rel(folder: string, path: string) {
  const f = folder.replaceAll("\\", "/").replace(/\/$/, "");
  const p = path.replaceAll("\\", "/");
  return p.startsWith(`${f}/`) ? p.slice(f.length + 1) : p;
}

/** Re-reads icons/ and makes urls for images not seen before. ponytail: re-reads only on open and after own writes; NR-style polling if devs edit icons/ by hand mid-session. */
export async function refreshIcons(state: SystemIcons) {
  try {
    // No icons/ yet is the normal start; anything else (no permission) is shown
    const listing = await listFolder(`${state.folder}/icons`, 1).catch((e) => {
      if ((e as Error)?.name === "NotFoundError") return [];
      throw e;
    });
    const files = listing.filter((e) => !e.directory && isAssetPath(e.name)).map((e) => rel(state.folder, e.path));
    files.sort((a, b) => a.localeCompare(b));
    for (const file of files) {
      if (state.urls[file]) continue;
      const bytes = await readFileBytes(`${state.folder}/${file}`);
      state.urls[file] = URL.createObjectURL(new Blob([bytes as BlobPart], { type: assetMime(file) }));
    }
    for (const file of Object.keys(state.urls)) {
      if (files.includes(file)) continue;
      URL.revokeObjectURL(state.urls[file]!);
      delete state.urls[file];
    }
    state.files = files;
    state.paths = scanIconPaths(files);
    state.error = "";
  } catch (e) {
    console.error("Could not read icons of", state.folder, e);
    state.error = `Could not read ${state.folder}/icons: ${(e as Error)?.message ?? e}`;
  }
  state.loaded = true;
}

/** The file NR shows for a target: its attribute, else a file at the default path. */
export function targetIconPath(state: SystemIcons, target: IconTarget): string | null {
  return target.icon || iconPath({ icon_paths: state.paths }, target.kind, target.keys);
}

/** Files at the default path that NR would match to one of the target's keys, in any spelling. */
function filesFor(state: SystemIcons, target: IconTarget): string[] {
  const keys = new Set(target.keys.map(iconKey));
  return Object.entries(state.paths[target.kind] ?? {})
    .filter(([key]) => keys.has(iconKey(key)))
    .map(([, path]) => path);
}

/** A filename NR matches back to `key`: the characters Windows forbids become _, as iconKey compares. */
function fileName(key: string) {
  return key.normalize("NFC").replace(/[<>:"/\\|?*]/g, "_").replace(/[. ]+$/, "");
}

function defaultPath(target: IconTarget, ext: string) {
  const folder = KIND_FOLDER[target.kind];
  // Named by the first key: the id where there is one, so a rename keeps the icon
  return folder ? `icons/${folder}/${fileName(target.keys[0]!)}.${ext}` : `icons/${target.kind}.${ext}`;
}

/** An image ready to write: svg kept as is, anything else scaled down and converted to webp. */
export async function prepareIcon(file: Blob, name = ""): Promise<{ data: Uint8Array; ext: string }> {
  let ext = "svg";
  let data: Blob = file;
  if (!(file.type === "image/svg+xml" || /\.svg$/i.test(name))) {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error(`${name || "This file"} is not an image the browser can read`);
    }
    const scale = Math.min(1, ICON_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    data = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not convert the image to webp"))), "image/webp", 0.9),
    );
    ext = "webp";
  }
  if (data.size > ICON_MAX_BYTES) {
    throw new Error(`${name || "The icon"} is ${Math.ceil(data.size / 1024)}KB after conversion; icons must be under ${ICON_MAX_BYTES / 1024}KB`);
  }
  return { data: new Uint8Array(await data.arrayBuffer()), ext };
}

/** Reads an image already in the folder, to copy it under another node's name. */
export async function readIcon(state: SystemIcons, path: string): Promise<{ data: Uint8Array; ext: string }> {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return { data: await readFileBytes(`${state.folder}/${path}`), ext };
}

/** One copy per target at its default path. The same key's file in another format goes, so NR has one to pick;
 * a file under the name stays, since other nodes of that name may use it, and the id wins over it in NR. */
export async function setIcons(state: SystemIcons, targets: IconTarget[], image: { data: Uint8Array; ext: string }) {
  for (const target of targets) {
    const path = defaultPath(target, image.ext);
    const same = filesFor(state, { ...target, keys: target.keys.slice(0, 1) });
    for (const old of same) if (old !== path) await deleteFile(`${state.folder}/${old}`);
    await writeFile(`${state.folder}/${path}`, image.data);
    // A new file at a path seen before needs a new url
    if (state.urls[path]) {
      URL.revokeObjectURL(state.urls[path]);
      delete state.urls[path];
    }
  }
  await refreshIcons(state);
}

/** Deletes every file at the default path that NR matches to the targets. The `icon` attribute is left alone. */
export async function removeIcons(state: SystemIcons, targets: IconTarget[]) {
  for (const path of new Set(targets.flatMap((t) => filesFor(state, t)))) await deleteFile(`${state.folder}/${path}`);
  await refreshIcons(state);
}

export function hasRemovableFile(state: SystemIcons, target: IconTarget) {
  return filesFor(state, target).length > 0;
}

/** NR splits catalogue names on settings.factionSeparator to group them under parent factions. */
export async function factionSeparator(folder: string): Promise<string | undefined> {
  try {
    const json = JSON.parse((await readFile(`${folder}/settings/settings.json`)).data);
    return typeof json?.factionSeparator === "string" ? json.factionSeparator : undefined;
  } catch {
    // ponytail: only settings/settings.json; a settings/factionSeparator.json file is not read
    return undefined;
  }
}

/** Every part of a name but the last, as NR's FactionPicker groups it. */
export function parentFactionName(name: string, divider: string | undefined): string | null {
  if (!divider) return null;
  const segments = name.split(divider).map((s) => s.trim());
  return segments.length > 1 ? segments.slice(0, -1).join(` ${divider} `) : null;
}

/** The icon target of a node in the right panel, or null for nodes NR shows no icon for. */
export function nodeTarget(node: any): IconTarget | null {
  switch (node?.editorTypeName) {
    case "gameSystem":
      return { kind: "system", label: "Game icon", keys: [node.id, "system"], icon: node.icon };
    case "catalogue":
      return { kind: "army", label: node.name, keys: [node.id, node.name], icon: node.icon };
    case "categoryEntry":
      return { kind: "category", label: node.name, keys: [node.id, node.name], icon: node.icon };
    case "categoryLink": {
      const target = node.target;
      return { kind: "category", label: target?.name ?? node.name, keys: [node.targetId, target?.name ?? node.name], icon: node.icon || target?.icon };
    }
    case "forceEntry":
      return { kind: "force", label: node.name, keys: [node.id, node.name], icon: node.icon };
  }
  return null;
}

/** The raw files of a system, libraries included, for collectIconChoices. */
export function systemFiles(system: GameSystemFiles) {
  return system.getAllCatalogueFiles().map((f) => getDataObject(f));
}

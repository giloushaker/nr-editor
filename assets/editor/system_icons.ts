// A system's icons as files beside its .gst, the convention NR reads (assets/shared/battlescribe/icons.ts). Setting one
// writes the file at the default path (icons/<kind>/<name slug>.<ext>) and always the node's `icon` attribute too, so
// the data says which file it uses and picking an existing image reuses it instead of copying.
import { reactive } from "vue";
import { ASSET_MIME, assetMime, iconKey, iconPath, isAssetPath, scanIconPaths, type IconPaths } from "~/assets/shared/battlescribe/icons";
import { iconFilePath, ownFiles, type IconOwner } from "~/assets/editor/icon_files";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import type { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { deleteFile, dirname, listFolder, readFile, readFileBytes, writeFile } from "~/electron/node_helpers";
import { permissionState, requestPermission } from "~/electron/web_fs";
import { useEditorStore } from "~/stores/editorStore";

/** What the editor accepts after conversion: NR stores every icon of an install for offline use. */
export const ICON_MAX_BYTES = 100 * 1024;
/** Longest side of a converted image; NR draws icons at 20-40px. */
const ICON_MAX_SIDE = 256;

/** One thing that takes an icon, and the keys NR tries for it, in its order. */
export interface IconTarget {
  kind: string;
  label: string;
  keys: string[];
  /** The node that holds the `icon` attribute; none for parent factions and the weapon icon, which are files only */
  node?: any;
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

// Relative to the .gst folder, or null for a path outside it; case-blind, since Windows paths can differ in case
function rel(folder: string, path: string): string | null {
  const f = folder.replaceAll("\\", "/").replace(/\/$/, "");
  const p = path.replaceAll("\\", "/");
  return p.toLowerCase().startsWith(`${f.toLowerCase()}/`) ? p.slice(f.length + 1) : null;
}

// Every path written into an `icon` attribute: relative to the .gst folder, under icons/, never an absolute disk path
function assertIconPath(path: string) {
  if (!path.startsWith("icons/") || /^([a-z]:)?\//i.test(path) || path.split("/").includes("..")) throw new Error(`Not an icon path under icons/: ${path}`);
}

/** Re-reads icons/ and makes urls for images not seen before. ponytail: re-reads only on open and after own writes; NR-style polling if devs edit icons/ by hand mid-session. */
export async function refreshIcons(state: SystemIcons) {
  try {
    // No icons/ yet is the normal start; anything else (no permission) is shown
    const listing = await listFolder(`${state.folder}/icons`, 1).catch((e) => {
      if ((e as Error)?.name === "NotFoundError") return [];
      throw e;
    });
    // Only files under the game's folder: a path it cannot relativize must never reach an attribute
    const files = listing.flatMap((e) => (!e.directory && isAssetPath(e.name) ? [rel(state.folder, e.path)] : [])).filter((p): p is string => p !== null);
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

const norm = (path: string) => path.replaceAll("\\", "/").replace(/^\.?\//, "");

/** The file NR shows for a target: its attribute, else a file at the default path. */
export function targetIconPath(state: SystemIcons, target: IconTarget): string | null {
  const own = target.node?.icon;
  return (typeof own === "string" && own ? norm(own) : null) || iconPath({ icon_paths: state.paths }, target.kind, target.keys);
}

/** Nodes that can hold an `icon`, by kind and id. Loading a file sets prototypes on its raw objects in place, so these
 * are the nodes the editor edits once the file is loaded. */
export function nodeIndex(system: GameSystemFiles): Map<string, any> {
  const byKey = new Map<string, any>();
  const forces = (list: any[] | undefined) => {
    for (const f of list ?? []) {
      byKey.set(`force\n${f.id}`, f);
      forces(f.forceEntries);
    }
  };
  const systemId = system.gameSystem ? getDataObject(system.gameSystem).id : undefined;
  for (const c of systemFiles(system) as any[]) {
    byKey.set(`${c.id === systemId ? "system" : "army"}\n${c.id}`, c);
    for (const e of c.categoryEntries ?? []) byKey.set(`category\n${e.id}`, e);
    forces(c.forceEntries);
  }
  return byKey;
}

/** Edits need every file loaded (store.set_field revalidates through the node's catalogue). */
async function attachNodes(system: GameSystemFiles, targets: IconTarget[]) {
  if (!system.allLoaded) await system.loadAll();
  const byKey = nodeIndex(system);
  for (const t of targets) t.node ??= byKey.get(`${t.kind}\n${t.keys[0]}`);
}

/** Every path an `icon` attribute points at, except `except`'s own: a file another node names is never deleted. */
function iconRefs(system: GameSystemFiles, except?: unknown): Set<string> {
  const refs = new Set<string>();
  const seen = new WeakSet<object>();
  const walk = (node: any) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (node !== except && typeof node.icon === "string" && node.icon) refs.add(norm(node.icon));
    for (const value of Object.values(node)) if (Array.isArray(value)) for (const item of value) walk(item);
  };
  for (const file of systemFiles(system)) walk(file);
  for (const catalogue of system.getAllLoadedCatalogues()) walk(catalogue);
  return refs;
}

/** Everything else of the target's kind that takes an icon, for name clashes and the delete rule. */
function othersOf(system: GameSystemFiles, target: IconTarget): IconOwner[] {
  const others: IconOwner[] = [];
  for (const [key, node] of nodeIndex(system)) {
    const [kind, id] = key.split("\n");
    if (kind !== target.kind || id === target.keys[0]) continue;
    others.push({ kind, keys: [id!, ...(node?.name ? [String(node.name)] : [])] });
  }
  // ponytail: parent factions are not listed; a catalogue named exactly like a parent shares its file
  return others;
}

/** Files at the default path that NR would match to one of the target's keys, in any spelling. */
function filesFor(state: SystemIcons, target: IconTarget): string[] {
  const keys = new Set(target.keys.map(iconKey));
  return Object.entries(state.paths[target.kind] ?? {})
    .filter(([key]) => keys.has(iconKey(key)))
    .map(([, path]) => path);
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

/** Reads an image already in the folder, to point nodes at (or copy, for those with no node). A file over the limit
 * was put there by hand and is refused like a new one. */
export async function readIcon(state: SystemIcons, path: string): Promise<{ data: Uint8Array; ext: string; from: string }> {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const data = await readFileBytes(`${state.folder}/${path}`);
  if (data.byteLength > ICON_MAX_BYTES) throw new Error(`${path} is ${Math.ceil(data.byteLength / 1024)}KB; icons must be under ${ICON_MAX_BYTES / 1024}KB`);
  return { data, ext, from: path };
}

/**
 * Sets one image on every target and points its `icon` at it. A new image is written once per target at its default
 * path (its name, or its id when another node's name compares the same); an image already in the folder is pointed at.
 * The target's other own files go (another spelling or extension, its id file), never a file another node matches or
 * names, nor the file its saved attribute names, so discarding the unsaved edit still finds that file.
 */
export async function setIcons(system: GameSystemFiles, state: SystemIcons, targets: IconTarget[], image: { data: Uint8Array; ext: string; from?: string }) {
  await attachNodes(system, targets);
  const store = useEditorStore();
  const written = new Set<string>();
  for (const target of targets) {
    const others = othersOf(system, target);
    // Nodeless targets (parent factions, weapon) are found by file name alone, so they always get their own copy
    const path = image.from && target.node ? image.from : iconFilePath(target, others, image.ext);
    assertIconPath(path);
    const saved = target.node?.icon ? norm(target.node.icon) : null;
    const stale = ownFiles(state.files, target, others, iconRefs(system, target.node)).filter((p) => p.toLowerCase() !== path.toLowerCase() && p !== saved);
    if (path !== image.from && !written.has(path)) {
      await writeFile(`${state.folder}/${path}`, image.data);
      // A new file at a path seen before needs a new url
      if (state.urls[path]) {
        URL.revokeObjectURL(state.urls[path]!);
        delete state.urls[path];
      }
      written.add(path);
    }
    if (target.node) store.set_field(target.node, "icon", path);
    for (const old of stale) await deleteFile(`${state.folder}/${old}`);
  }
  await refreshIcons(state);
}

/** Moves the target's file to `to` (relative to the .gst folder) and points its `icon` there. */
export async function renameIcon(system: GameSystemFiles, state: SystemIcons, target: IconTarget, to: string) {
  const path = norm(to.trim());
  if (!isAssetPath(path)) throw new Error(`Keep icons under icons/ with an image extension (${Object.keys(ASSET_MIME).join(", ")})`);
  assertIconPath(path);
  const from = targetIconPath(state, target);
  if (from === path) return;
  await attachNodes(system, [target]);
  const existing = state.files.find((f) => f.toLowerCase() === path.toLowerCase());
  if (from && existing === from) {
    // Only the case changed: Windows and macOS see one file, so it is rewritten under the new spelling, never deleted
    const bytes = await readFileBytes(`${state.folder}/${from}`);
    await deleteFile(`${state.folder}/${from}`);
    await writeFile(`${state.folder}/${path}`, bytes);
  } else if (!existing) {
    if (!from) throw new Error("No icon to rename yet: set one first");
    await writeFile(`${state.folder}/${path}`, await readFileBytes(`${state.folder}/${from}`));
  }
  const pointTo = existing && existing !== from ? existing : path;
  if (target.node) useEditorStore().set_field(target.node, "icon", pointTo);
  // The old file goes unless another node matches or names it
  if (from && from.toLowerCase() !== path.toLowerCase() && ownFiles([from], target, othersOf(system, target), iconRefs(system, target.node)).length) {
    await deleteFile(`${state.folder}/${from}`);
  }
  await refreshIcons(state);
}

/** Clears the targets' `icon` and deletes their own files; a file another node matches or names stays, and so does the
 * file the cleared attribute named, so discarding the unsaved edit still finds it. */
export async function removeIcons(system: GameSystemFiles, state: SystemIcons, targets: IconTarget[]) {
  await attachNodes(system, targets);
  const store = useEditorStore();
  for (const target of targets) {
    const saved = target.node?.icon ? norm(target.node.icon) : null;
    const own = ownFiles(state.files, target, othersOf(system, target), iconRefs(system, target.node)).filter((p) => p !== saved);
    if (target.node?.icon) store.set_field(target.node, "icon", undefined);
    for (const path of own) await deleteFile(`${state.folder}/${path}`);
  }
  await refreshIcons(state);
}

export function hasRemovableFile(state: SystemIcons, target: IconTarget) {
  return !!target.node?.icon || filesFor(state, target).length > 0;
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
      return { kind: "system", label: "Game icon", keys: [node.id, "system"], node };
    case "catalogue":
      return { kind: "army", label: node.name, keys: [node.id, node.name], node };
    case "categoryEntry":
    case "forceEntry":
      return { kind: node.editorTypeName === "forceEntry" ? "force" : "category", label: node.name, keys: [node.id, node.name], node };
    case "categoryLink": {
      // Set on the category itself, so every link to it shows it
      const target = node.target;
      return target ? { kind: "category", label: target.name, keys: [target.id, target.name], node: target } : null;
    }
  }
  return null;
}

/** The raw files of a system, libraries included, for collectIconChoices. */
export function systemFiles(system: GameSystemFiles) {
  return system.getAllCatalogueFiles().map((f) => getDataObject(f));
}

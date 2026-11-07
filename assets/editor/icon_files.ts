// Which file a node's icon lives in, and which files are only its own. Pure, so the rules are checked without a folder.
// NR finds an icon by the node's id first, then its name (assets/shared/battlescribe/icons.ts iconKey compares names).
import { iconKey, scanIconPaths } from "~/assets/shared/battlescribe/icons";

/** Something that takes an icon: its kind and the keys NR tries, id first. */
export interface IconOwner {
  kind: string;
  keys: string[];
}

/** Where a new file goes, per kind. system and weapon are single files directly in icons/. */
export const KIND_FOLDER: Record<string, string> = { category: "categories", force: "forces", army: "factions" };

/** Whether NR would show the file named `base` for this owner. */
export function fileMatches(base: string, owner: IconOwner): boolean {
  const loose = iconKey(base);
  return owner.keys.some((key) => key === base || (!!loose && iconKey(key) === loose));
}

/** The kind and base name NR reads off a path under icons/, or null for a file it does not index. */
export function indexedAs(path: string): { kind: string; base: string } | null {
  for (const [kind, map] of Object.entries(scanIconPaths([path]))) for (const base of Object.keys(map)) return { kind, base };
  return null;
}

/**
 * The path a new icon is written to: the readable name, unless another owner's name compares the same, then the id, so
 * each keeps its own icon (NR tries the id first). `others` are the owners of the same kind, this one excluded.
 */
export function iconFilePath(target: IconOwner, others: IconOwner[], ext: string): string {
  const folder = KIND_FOLDER[target.kind];
  if (!folder) return `icons/${target.kind}.${ext}`;
  const [id, ...names] = target.keys;
  const name = names[names.length - 1] ?? id!;
  const slug = iconKey(name);
  const taken = others.some((o) => o.keys.some((k) => iconKey(k) === slug));
  return `icons/${folder}/${!slug || (taken && id !== name) ? id : slug}.${ext}`;
}

/**
 * Files only this owner uses: NR matches them to it, no other owner of the kind matches them, and no `icon` attribute
 * points at them. Only these are ever deleted, so a file another node relies on, by name or by attribute, stays.
 */
export function ownFiles(files: string[], target: IconOwner, others: IconOwner[], refs: Set<string>): string[] {
  return files.filter((path) => {
    const at = indexedAs(path);
    if (!at || at.kind !== target.kind || refs.has(path)) return false;
    return fileMatches(at.base, target) && !others.some((o) => fileMatches(at.base, o));
  });
}

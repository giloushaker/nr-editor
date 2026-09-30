import type { PatchIndex } from "~/assets/shared/types/system_types";
// Copy of nuxt-nr assets/ts/systems/patch_files.ts: keep the two in sync.

/** `patch.json` and its split parts (`patch.basesizes.json`), all merged into `settings.patch`. */
export const PATCH_FILE = /^patch(\.[\w-]+)?\.json$/i;

export function isPatchFile(name: string): boolean {
  return PATCH_FILE.test(name);
}

type Entry = Record<string, unknown>;

// These gate or replace the whole entry, so combining them with another file's entry would change what it does.
const WHOLE_ENTRY = ["$patchConditions", "$expect", "$move"];
// Operators holding lists per path: two files' lists simply add up.
const LISTS = ["$patchPush", "$patchRemove", "$patchUpdate"];

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);

function combine(a: Entry, b: Entry, where: string): Entry {
  const gate = WHOLE_ENTRY.find((key) => key in a || key in b);
  if (gate) throw new Error(`${where}: cannot combine an entry using ${gate}`);
  const out: Entry = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (!(key in out)) out[key] = value;
    else if (key === "$note") out[key] = `${out[key]} / ${value}`;
    else if (LISTS.includes(key)) {
      const paths = { ...(out[key] as Entry) };
      for (const [path, list] of Object.entries(value as Entry)) paths[path] = path in paths ? [...asList(paths[path]), ...asList(list)] : list;
      out[key] = paths;
    } else if (JSON.stringify(out[key]) !== JSON.stringify(value)) throw new Error(`${where}: both set ${key}`);
  }
  return out;
}

// patchJson applies one entry per field value, so entries of different files on the same object are combined.
export function mergePatches(parts: Array<{ name: string; patch: PatchIndex }>): PatchIndex {
  const merged: PatchIndex = {};
  const owner: Record<string, string> = {};
  // patch.json first, then its parts by name, so the order does not depend on the directory listing.
  const order = (name: string) => (name.toLowerCase() === "patch.json" ? "" : name);
  for (const { name, patch } of [...parts].sort((a, b) => order(a.name).localeCompare(order(b.name)))) {
    for (const [field, entries] of Object.entries(patch)) {
      merged[field] ??= {};
      for (const [value, entry] of Object.entries(entries)) {
        const key = `${field}=${value}`;
        merged[field][value] = owner[key] ? combine(merged[field][value] as Entry, entry as Entry, `Patch entry ${key} in ${owner[key]} and ${name}`) : entry;
        owner[key] = owner[key] ? `${owner[key]}, ${name}` : name;
      }
    }
  }
  return merged;
}

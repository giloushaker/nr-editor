/**
 * What a paste read becomes in the tree editor, under whatever is selected there:
 *   a folder row (Shared Profiles, Shared Selection Entries, Selection Entries) or the
 *     catalogue itself   -> one node per row in that list, sub-lines as extra profiles
 *   an entry, group or anything else that holds profiles
 *     one row            -> its stat line, on the node itself
 *     several rows       -> one child entry per row, each with its stat line
 * One undo step for the lot.
 */
import type { EditorBase, Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { BSICharacteristicType, BSIProfile, BSISelectionEntry } from "~/assets/shared/battlescribe/bs_types";
import { toProfileType } from "~/features/setup/bs_adapter";
import { idFor, ownedLineId } from "~/features/setup/rename";
import { slugify } from "~/features/ui/ids";
import type { PasteSuccess, PastedRow } from "./model";
import type { PastedLine } from "./text";

type Node = EditorBase & Record<string, any>;
interface Store {
  add(data: Record<string, any>, key: string, parent: EditorBase | Catalogue): Promise<unknown>;
  undoStackPos: number;
  collapse_undo(from: number, type?: string): void;
}
/** A folder row in the tree is not a node: the panel hands over its list key. */
export type PasteTarget = EditorBase | Catalogue | { folder: string };

/** A rule with that text: on the selected node, or shared when the catalogue itself is the target. */
export async function pasteRuleIntoTree(store: Store, catalogue: Catalogue, target: PasteTarget, name: string, text: string) {
  const node = "folder" in target || (target as Catalogue).isCatalogue?.() ? undefined : (target as Node);
  const data = { id: idFor(catalogue, name, node?.id), name, description: text, hidden: false };
  await store.add(data, node ? "rules" : "sharedRules", node ?? catalogue);
}

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const atMost = (id: string, n: number) => [{ id: `${id}-max`, type: "max", value: n, field: "selections", scope: "parent", shared: true }];
/** Whether each line is already a shared entry here or in an import: then it becomes a link. */
export function sharedFor(catalogue: Catalogue, lines: PastedLine[]): (Node | undefined)[] {
  const all = [catalogue, ...(catalogue.imports || [])].flatMap((c) => (c.sharedSelectionEntries || []) as Node[]);
  return lines.map((l) => all.find((e) => fold(e.getName()) === fold(l.name)));
}
/**
 * Plain lines as entries under the selected node (or shared, on the catalogue): a link when the
 * name is already shared, a new upgrade entry with a todo: comment otherwise. A leading count is a max; no min, the author decides that.
 */
export async function pasteLinesIntoTree(store: Store, catalogue: Catalogue, target: PasteTarget, lines: PastedLine[]): Promise<number> {
  const folder = "folder" in target ? target.folder : undefined;
  const node = folder || (target as Catalogue).isCatalogue?.() ? undefined : (target as Node);
  const shared = sharedFor(catalogue, lines);
  const from = store.undoStackPos;
  for (const [i, line] of lines.entries()) {
    const hit = shared[i];
    let id = idFor(catalogue, line.name, node?.id);
    // A link must never take its target's id: it then resolves to itself and the loader recurses
    // on reload. idFor asks the index, and the shared entry is not always in it yet.
    if (hit && id === hit.id) id = `${id}-link`;
    const constraints = line.count ? atMost(id, line.count) : [];
    if (hit) await store.add({ id, name: hit.getName(), targetId: hit.id, type: "selectionEntry", hidden: false, import: true, constraints }, "entryLinks", node ?? catalogue);
    else await store.add({ id, name: line.name, type: "upgrade", hidden: false, import: true, constraints, comment: "todo: not a shared entry yet" }, node ? "selectionEntries" : folder ?? "sharedSelectionEntries", node ?? catalogue);
  }
  store.collapse_undo(from, "paste");
  return lines.length;
}

export async function pasteIntoTree(store: Store, catalogue: Catalogue, target: PasteTarget, r: PasteSuccess): Promise<number> {
  const type = [...catalogue.iterateProfileTypes()].find((t) => t.id === r.typeId) as Node | undefined;
  if (!type) return 0;
  const rows = r.rows.filter((row) => row.name.trim() || Object.keys(row.values).length);
  const from = store.undoStackPos;
  let made = 0;

  const profile = (row: PastedRow, id: string, fallbackName = ""): Partial<BSIProfile> => ({
    id,
    name: row.name.trim() || fallbackName,
    typeId: type.id,
    typeName: type.name,
    hidden: false,
    characteristics: (type.characteristicTypes || []).map((c: BSICharacteristicType) => ({ name: c.name, typeId: c.id, $text: row.values[c.id] ?? c.valueFormat?.empty ?? "" })),
  });
  const entry = (row: PastedRow, id: string): Partial<BSISelectionEntry> => ({ id, name: row.name.trim(), type: "upgrade", hidden: false, import: true, profiles: [] });

  const isFolder = (t: PasteTarget): t is { folder: string } => "folder" in t && typeof t.folder === "string";
  const isCatalogue = (t: PasteTarget): t is Catalogue => !isFolder(t) && typeof (t as Catalogue).isCatalogue === "function" && (t as Catalogue).isCatalogue();

  // Where the rows go: a list on the catalogue, or a node.
  let listKey: string | undefined;
  let owner: Node | undefined;
  if (isFolder(target)) listKey = target.folder;
  else if (isCatalogue(target)) listKey = toProfileType(type as any).sharedAs === "text" ? "sharedProfiles" : "sharedSelectionEntries";
  else owner = target as Node;

  if (listKey === "sharedProfiles" || listKey === "profiles") {
    for (const row of rows) {
      await store.add(profile(row, idFor(catalogue, row.name, undefined, slugify(type.name))), "sharedProfiles", catalogue);
      made++;
    }
  } else if (listKey) {
    // Entries with their stat line; a sub-line is another line on the entry above.
    let last: Node | undefined;
    for (const row of rows) {
      if (row.sub && last) {
        await store.add(profile(row, idFor(catalogue, row.name, last.id, slugify(type.name))), "profiles", last);
        continue;
      }
      const id = idFor(catalogue, row.name);
      last = (await store.add(entry(row, id), listKey, catalogue)) as Node;
      made++;
      if (Object.keys(row.values).length) await store.add(profile(row, `${id}-${slugify(type.name)}`), "profiles", last);
    }
  } else if (owner) {
    const one = rows.length === 1 && !rows[0].sub;
    if (one) {
      const row = rows[0];
      const own = slugify(row.name) && slugify(row.name) !== slugify(owner.name) ? row.name : "";
      const id = own ? idFor(catalogue, own, owner.id, slugify(type.name)) : ownedLineId(catalogue, owner.id, type.name, "");
      await store.add(profile(row, id, owner.name), "profiles", owner);
      made++;
    } else {
      let last: Node | undefined;
      for (const row of rows) {
        if (row.sub && last) {
          await store.add(profile(row, idFor(catalogue, row.name, last.id, slugify(type.name))), "profiles", last);
          continue;
        }
        const id = idFor(catalogue, row.name, owner.id);
        last = (await store.add(entry(row, id), "selectionEntries", owner)) as Node;
        made++;
        if (Object.keys(row.values).length) await store.add(profile(row, `${id}-${slugify(type.name)}`), "profiles", last);
      }
    }
  }
  store.collapse_undo(from, "paste");
  return made;
}

/**
 * One rule for ids, used by every rename in the card pages.
 *
 * An id is made from the name when a thing is created ("Bolt pistol" -> bolt-pistol, a unit's
 * model -> legion-of-the-damned-squad-sergeant). It then follows the name for as long as two
 * things hold: the id still reads as that name (nobody typed a custom one), and nothing links
 * to it yet. Once a link exists, or the author set the id by hand, renaming leaves the id
 * alone, so files stay diffable and references never break. A thing created with no name
 * ("" or a placeholder) gets its real id on its first rename.
 */
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { slugify, uniqueId } from "~/features/ui/ids";
import type { useEditorStore } from "~/stores/editorStore";

type Store = ReturnType<typeof useEditorStore>;
type Node = EditorBase & { id: string; name: string; refs?: unknown[]; other_refs?: unknown[] };

/** The name as an id would spell it: at most four words and 32 characters, cut at a word. */
export function shortSlug(name: string) {
  const words = slugify(name).split("-").filter(Boolean).slice(0, 4);
  let out = "";
  for (const w of words) {
    if (out && out.length + 1 + w.length > 32) break;
    out = out ? `${out}-${w}` : w;
  }
  return out;
}

/**
 * Id for a new thing. Short first: the name alone when nobody has it ("boltgun", "replace-boltgun").
 * Taken already? The last two words of the parent's id go in front ("squad-model-boltgun"). Still
 * taken? A number. The fallback stands in for an unnamed thing.
 */
export function idFor(catalogue: Catalogue, name: string, parentId?: string, fallback = "new") {
  const base = shortSlug(name) || fallback;
  const taken = (id: string) => catalogue.findOptionByIdGlobal(id) !== undefined;
  if (!taken(base)) return base;
  if (parentId) {
    const tail = parentId.split("-").filter(Boolean).slice(-2).join("-");
    const withParent = tail ? `${tail}-${base}` : base;
    if (!taken(withParent)) return withParent;
    return uniqueId(withParent, taken);
  }
  return uniqueId(base, taken);
}

/** Whether the id still ends in what the name would give: nothing custom was typed over it. */
function derivedFrom(id: string, name: string) {
  const s = shortSlug(name);
  return !s || id === s || id.endsWith(`-${s}`);
}

/** Moves a node to a new id: the index is keyed by id, and the change goes on the undo stack. */
export function setId(store: Store, node: Node, id: string) {
  if (id === node.id) return;
  const catalogue = node.getCatalogue();
  catalogue.removeFromIndex(node);
  store.set_field(node, "id", id);
  catalogue.addToIndex(node);
}

/** A line named after its owner (a model's stat line, a weapon's only line): `${ownerId}-${type}`. */
export function ownedLineId(catalogue: Catalogue, ownerId: string, typeName: string, current: string) {
  const want = `${ownerId}-${slugify(typeName)}`;
  return current === want ? current : uniqueId(want, (id) => catalogue.findOptionByIdGlobal(id) !== undefined);
}

export function renameNode(store: Store, node: Node, name: string) {
  const old = node.name ?? "";
  if (old === name) return;
  store.set_field(node, "name", name);
  const linked = (node.refs?.length ?? 0) + (node.other_refs?.length ?? 0) > 0;
  if (linked || !derivedFrom(node.id, old)) return;
  const catalogue = node.getCatalogue();
  const oldSlug = slugify(old);
  const prefix = oldSlug && node.id.endsWith(`-${oldSlug}`) ? node.id.slice(0, -oldSlug.length - 1) : node.id === oldSlug ? "" : node.id.replace(/-new(-\d+)?$/, "").replace(/^new(-\d+)?$/, "");
  setId(store, node, idFor(catalogue, name, prefix || undefined));
}

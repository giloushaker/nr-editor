/**
 * Self-check for the left panel's open/collapsed tree. Run with `npm run check`.
 */
import { isOpen, setOpen, openKeys, type OpenPathEntry, type OpenTree } from "./open_state";

function assert(ok: unknown, msg: string): void {
  if (!ok) throw new Error("FAILED: " + msg);
  console.log("  ok -", msg);
}

const p = (...segs: Array<[string, number]>): OpenPathEntry[] => segs.map(([key, index]) => ({ key, index }));

const root = p(["selectionEntries", 2]);
const child = p(["selectionEntries", 2], ["selectionEntries", 0]);
const sibling = p(["selectionEntries", 3]);

console.log("\nleft panel open state");

// The shape a read walks must be the shape a write builds; this is the whole contract.
assert(
  JSON.stringify(openKeys(root)) === JSON.stringify(["selectionEntries", 0, "selectionEntries", 2]),
  "path[0] is written twice: once as the category box, once as its own segment",
);

let tree: OpenTree = {};
assert(!isOpen(tree, root), "nothing is open in an empty tree");
assert(!isOpen(undefined, root), "a catalogue with no saved state has nothing open");
assert(!isOpen(tree, []), "an empty path is never open");

setOpen(tree, root, true);
assert(isOpen(tree, root), "an opened entry reads back as open");
assert(!isOpen(tree, sibling), "opening one entry does not open its sibling");
assert(Boolean(tree["selectionEntries"]), "opening an entry marks its category open too");

setOpen(tree, child, true);
assert(isOpen(tree, child) && isOpen(tree, root), "opening a child keeps the parent open");

setOpen(tree, root, false);
assert(!isOpen(tree, root), "closing an entry reads back as closed");
assert(!isOpen(tree, child), "closing an entry forgets its descendants");

// Restoring a session re-opens boxes that are already recorded; that must not wipe the subtree.
tree = {};
setOpen(tree, child, true);
setOpen(tree, root, true);
assert(isOpen(tree, child), "re-opening a parent preserves what was open under it");

setOpen(tree, sibling, false);
assert(isOpen(tree, child), "closing a never-opened sibling leaves the rest of the tree alone");

console.log("\nall open state checks passed");

/**
 * Checks for bs_initialize.ts. Run by `npm run check`.
 *
 * The bug this exists to prevent is silent: a node without its prototype looks fine in the tree
 * and in the saved file, and only shows up when something calls a method on it -- often much
 * later, in a script, where it reads as a broken script rather than a broken insert. The cases
 * that matter are the mixed subtree (part live, part plain) and the back-references, since
 * getting the second wrong turns every insert into a full-catalogue walk.
 */
import { BACK_REFERENCES, initializeSubtree, type InitializeHooks } from "./bs_initialize";

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log("  ok -", msg);
  } else {
    failures++;
    console.log("  NOT OK -", msg);
  }
}

/** Stands in for a prototype: a node is "initialized" once it carries a type. */
interface Node {
  id?: string;
  type?: string;
  [key: string]: unknown;
}

function hooks(): InitializeHooks & { done: Array<{ node: Node; key: string }> } {
  const done: Array<{ node: Node; key: string }> = [];
  return {
    done,
    initialized: (node) => (node as Node).type !== undefined,
    initialize: (node, key) => {
      (node as Node).type = key;
      done.push({ node: node as Node, key });
    },
  };
}

console.log("initializeSubtree");

{
  const entry: Node = { id: "e", selectionEntries: [{ id: "child" }] };
  const h = hooks();
  const count = initializeSubtree({ selectionEntries: entry }, h);
  assert(count === 2, "initializes a plain subtree");
  assert(entry.type === "selectionEntries", "the root takes the key it was wrapped under");
  assert((entry.selectionEntries as Node[])[0].type === "selectionEntries", "children take their own key");
}

{
  // The case the shared walk misses: a live node with a freshly built child under it.
  const live: Node = { id: "live", type: "selectionEntries", constraints: [{ id: "fresh" }] };
  const h = hooks();
  const count = initializeSubtree({ selectionEntries: live }, h);
  assert(count === 1, "descends past an already-initialized node");
  assert((live.constraints as Node[])[0].type === "constraints", "and initializes the plain child below it");
}

{
  const first: Node = { id: "a" };
  const second: Node = { id: "b" };
  // A hole at index 0 used to make the shared walk skip the whole array.
  const h = hooks();
  initializeSubtree({ selectionEntries: [null, first, second] }, h);
  assert(first.type === "selectionEntries" && second.type === "selectionEntries", "a hole at index 0 does not hide the rest");
}

{
  const child: Node = { id: "child" };
  const parent: Node = { id: "parent", type: "selectionEntries", selectionEntries: [child] };
  child.parent = parent;
  child.catalogue = { id: "cat", selectionEntries: [{ id: "unrelated" }] };
  const h = hooks();
  const count = initializeSubtree({ selectionEntries: parent }, h);
  assert(count === 1, "only the child is initialized, not what its back-references reach");
  assert(h.done.every((d) => d.node.id !== "unrelated"), "does not walk out through catalogue");
}

{
  // Two nodes pointing at each other through a key that is not in the back-reference list: the
  // visited set, not the list, is what makes this terminate.
  const a: Node = { id: "a" };
  const b: Node = { id: "b", selectionEntries: [a] };
  a.selectionEntries = [b];
  const h = hooks();
  const count = initializeSubtree({ selectionEntries: a }, h);
  assert(count === 2, "a cycle through an unknown key terminates");
}

{
  const live: Node = { id: "live", type: "selectionEntries", constraints: [{ id: "c", type: "constraints" }] };
  const h = hooks();
  assert(initializeSubtree({ selectionEntries: live }, h) === 0, "re-running over a live subtree changes nothing");
}

assert(BACK_REFERENCES.has("catalogue") && BACK_REFERENCES.has("parent"), "the two that reach the whole document are listed");

console.log(failures ? `${failures} FAILED` : "all ok");
if (failures) process.exit(1);

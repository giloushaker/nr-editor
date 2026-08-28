/**
 * Checks for bs_link_cycles.ts. Run by `npm run check`.
 *
 * A wrong answer here is either a false "this link expands forever" on a catalogue that is
 * fine, or -- worse -- silence on one that hangs the roster builder. Neither is visible from
 * the editor until someone hits it, so the cases live here instead.
 */
import { CycleIndex, type CycleSource } from "./bs_link_cycles";

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log("  ok -", msg);
  } else {
    failures++;
    console.log("  NOT OK -", msg);
  }
}

/** A node in the fixtures: `to` is what it links at, if it is a link. */
interface Node {
  name: string;
  parent?: Node;
  to?: Node;
}

/**
 * Builds the source the way the editor does: referrers of a node are the links pointing at it,
 * and a link's parent is the entry it sits in.
 */
function sourceOf(all: Node[]): CycleSource<Node> {
  const referrers = new Map<Node, Node[]>();
  for (const node of all) {
    if (!node.to) continue;
    const list = referrers.get(node.to);
    if (list) list.push(node);
    else referrers.set(node.to, [node]);
  }
  return {
    links: all.filter((n) => n.to),
    parentOf: (n) => n.parent,
    referrersOf: (n) => referrers.get(n),
  };
}

console.log("\nlink cycles");

// A link pointing somewhere that cannot contain it is not a cycle.
{
  const entry: Node = { name: "entry" };
  const other: Node = { name: "other" };
  const link: Node = { name: "link", parent: entry, to: other };
  const index = CycleIndex.build(sourceOf([entry, other, link]));
  assert(!index.sameComponent(link, other), "a link to an unrelated entry is fine");
  assert(index.size === 0, "and nothing is recorded as cyclic");
}

// A link whose target is the entry it lives in expands forever.
{
  const entry: Node = { name: "entry" };
  const link: Node = { name: "link", parent: entry, to: entry };
  const index = CycleIndex.build(sourceOf([entry, link]));
  assert(index.sameComponent(link, entry), "a link to its own container is a cycle");
}

// The same, one level further up: the target is an ancestor rather than the direct parent.
{
  const outer: Node = { name: "outer" };
  const inner: Node = { name: "inner", parent: outer };
  const link: Node = { name: "link", parent: inner, to: outer };
  const index = CycleIndex.build(sourceOf([outer, inner, link]));
  assert(index.sameComponent(link, outer), "a link to an ancestor is a cycle");
}

// Two shared entries that each link to the other. Neither link is inside the other's tree, so
// only following referrers finds this one.
{
  const a: Node = { name: "a" };
  const b: Node = { name: "b" };
  const linkAB: Node = { name: "a->b", parent: a, to: b };
  const linkBA: Node = { name: "b->a", parent: b, to: a };
  const index = CycleIndex.build(sourceOf([a, b, linkAB, linkBA]));
  assert(index.sameComponent(linkAB, b), "mutual links between two entries are a cycle");
  assert(index.sameComponent(linkBA, a), "and it is reported from both sides");
}

// Three entries in a ring, to prove it is not just the two-node case.
{
  const a: Node = { name: "a" };
  const b: Node = { name: "b" };
  const c: Node = { name: "c" };
  const ab: Node = { name: "a->b", parent: a, to: b };
  const bc: Node = { name: "b->c", parent: b, to: c };
  const ca: Node = { name: "c->a", parent: c, to: a };
  const index = CycleIndex.build(sourceOf([a, b, c, ab, bc, ca]));
  assert(index.sameComponent(ab, b), "a three-entry ring is a cycle");
  assert(index.sameComponent(bc, c), "every link in the ring is in it");
  assert(index.sameComponent(ca, a), "including the one that closes it");
}

// A chain that never comes back must not be reported, however long it is.
{
  const all: Node[] = [];
  let previous: Node | undefined;
  for (let i = 0; i < 50; i++) {
    const entry: Node = { name: `entry${i}` };
    all.push(entry);
    if (previous) all.push({ name: `link${i}`, parent: previous, to: entry });
    previous = entry;
  }
  const index = CycleIndex.build(sourceOf(all));
  assert(index.size === 0, "a long chain of links is not a cycle");
}

// One entry in a cycle must not drag an unrelated neighbour into it.
{
  const a: Node = { name: "a" };
  const b: Node = { name: "b" };
  const spare: Node = { name: "spare" };
  const ab: Node = { name: "a->b", parent: a, to: b };
  const ba: Node = { name: "b->a", parent: b, to: a };
  const aside: Node = { name: "a->spare", parent: a, to: spare };
  const index = CycleIndex.build(sourceOf([a, b, spare, ab, ba, aside]));
  assert(index.sameComponent(ab, b), "the cycle is still found");
  assert(!index.sameComponent(aside, spare), "a link out of a cyclic entry is not itself cyclic");
}

// Deep enough that a recursive implementation would blow the stack.
{
  const all: Node[] = [];
  const root: Node = { name: "root" };
  all.push(root);
  let previous = root;
  for (let i = 0; i < 20000; i++) {
    const child: Node = { name: `n${i}`, parent: previous };
    all.push(child);
    previous = child;
  }
  all.push({ name: "deep-link", parent: previous, to: root });
  const index = CycleIndex.build(sourceOf(all));
  assert(index.size > 0, "a 20k-deep chain back to the root is found without overflowing");
}

// Nodes the graph never saw are not in a cycle, and are not equal to each other.
{
  const entry: Node = { name: "entry" };
  const link: Node = { name: "link", parent: entry, to: entry };
  const stranger: Node = { name: "stranger" };
  const other: Node = { name: "other" };
  const index = CycleIndex.build(sourceOf([entry, link]));
  assert(!index.sameComponent(stranger, other), "two unknown nodes are not the same component");
  assert(!index.sameComponent(link, undefined), "an unresolved target is not a cycle");
}

if (failures) {
  console.log(`\n${failures} link cycle check(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\nall link cycle checks passed");
}

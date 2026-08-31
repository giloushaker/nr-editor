/**
 * Self-check for the reference index. Run with `npm run check`.
 */
import { ReferenceIndex } from "./bs_reference_index";

function assert(ok: unknown, msg: string): void {
  if (!ok) throw new Error("FAILED: " + msg);
  console.log("  ok -", msg);
}

const names = (nodes: any[]) =>
  nodes
    .map((n) => n.name)
    .sort()
    .join(",");

console.log("\nreference index");

// Basic inversion: a node's outgoing edge becomes the target's incoming referrer.
{
  const index = new ReferenceIndex<any>();
  const link = { name: "link" };
  index.set(link, [{ id: "target", kind: "link" }]);
  assert(names(index.referrers("target", "link")) === "link", "an edge shows up as a referrer of its target");
  assert(index.referrers("target", "other").length === 0, "kinds are kept apart");
  assert(index.referrers("nothing", "link").length === 0, "an unreferenced id has no referrers");
}

// The case the old refs arrays could not handle: after a retarget the previous target is
// unreachable from the link, so only the index can report that it lost a referrer.
{
  const index = new ReferenceIndex<any>();
  const link = { name: "link" };
  index.set(link, [{ id: "a", kind: "link" }]);
  const affected = index.set(link, [{ id: "b", kind: "link" }]).sort();
  assert(affected.join(",") === "a,b", "retargeting reports both the old and the new target");
  assert(index.referrers("a", "link").length === 0, "the old target loses the referrer");
  assert(names(index.referrers("b", "link")) === "link", "the new target gains it");
}

// Reindexing with no actual change must not churn -- revalidating on every keystroke that
// leaves the edge alone would defeat the point.
{
  const index = new ReferenceIndex<any>();
  const link = { name: "link" };
  index.set(link, [{ id: "a", kind: "link" }]);
  assert(index.set(link, [{ id: "a", kind: "link" }]).length === 0, "an unchanged edge affects nothing");
}

// Several referrers on one target, removed independently.
{
  const index = new ReferenceIndex<any>();
  const one = { name: "one" };
  const two = { name: "two" };
  index.set(one, [{ id: "shared", kind: "link" }]);
  index.set(two, [{ id: "shared", kind: "link" }]);
  assert(names(index.referrers("shared", "link")) === "one,two", "a target collects every referrer");
  index.remove(one);
  assert(names(index.referrers("shared", "link")) === "two", "removing one referrer leaves the others");
  assert(index.remove(two).join() === "shared", "removing the last referrer reports the target");
  assert(index.referrers("shared", "link").length === 0, "the target ends up with none");
}

// A node with several outgoing edges of both kinds.
{
  const index = new ReferenceIndex<any>();
  const condition = { name: "condition" };
  index.set(condition, [
    { id: "scope", kind: "other" },
    { id: "child", kind: "other" },
  ]);
  assert(index.count("scope") === 1 && index.count("child") === 1, "every edge of a node is indexed");
  const affected = index.set(condition, [{ id: "child", kind: "other" }]).join();
  assert(affected === "scope", "dropping one edge reports only that target");
  assert(index.count("child") === 1, "the surviving edge is untouched");
}

// count() spans both kinds -- the tree badge shows one total.
{
  const index = new ReferenceIndex<any>();
  index.set({ name: "a" }, [{ id: "t", kind: "link" }]);
  index.set({ name: "b" }, [{ id: "t", kind: "other" }]);
  assert(index.count("t") === 2, "count() spans both kinds");
}

// Unloading a catalogue drops its nodes' edges without touching anyone else's.
{
  const index = new ReferenceIndex<any>();
  const mine = { name: "mine", cat: "A" };
  const theirs = { name: "theirs", cat: "B" };
  index.set(mine, [{ id: "t", kind: "link" }]);
  index.set(theirs, [{ id: "t", kind: "link" }]);
  const affected = index.purge((n) => n.cat === "A");
  assert(affected.join() === "t", "purge reports the affected targets");
  assert(names(index.referrers("t", "link")) === "theirs", "purge only drops the matching nodes");
}

// referrers() hands out a shared array; an id with none must not be corruptible.
{
  const index = new ReferenceIndex<any>();
  assert(index.referrers("none", "link") === index.referrers("other", "link"), "empty results share one array");
  assert(Object.isFrozen(index.referrers("none", "link")), "the empty result is frozen");
}

/**
 * The same node reaching the index under two identities.
 *
 * Vue hands out a reactive proxy for a node reached through the catalogue tree and the raw
 * object elsewhere -- the load path uses the first, set_field and undo the second. The index is
 * markRaw'd, so nothing normalises that for us any more. When it went unhandled, detach failed
 * to find what it had recorded and the next attach pushed a second copy, so the node showed up
 * twice in its target's refs.
 */
{
  const index = new ReferenceIndex<any>();
  const node = { name: "n" };
  const proxy = { name: "n", __v_raw: node } as any;

  index.set(proxy, [{ id: "t", kind: "link" }]);
  assert(index.referrers("t", "link").length === 1, "the proxy is recorded once");

  // Same node, raw this time, pointed somewhere else: the old edge must be found and dropped.
  const affected = index.set(node, [{ id: "u", kind: "link" }]);
  assert(affected.sort().join() === "t,u", "retargeting under the other identity reports both");
  assert(index.referrers("t", "link").length === 0, "the previous target keeps no stale referrer");
  assert(index.referrers("u", "link").length === 1, "the new target has it exactly once");

  // And back again, to prove neither direction leaves a duplicate behind.
  index.set(proxy, [{ id: "t", kind: "link" }]);
  assert(index.referrers("t", "link").length === 1, "switching back does not double-list");
  assert(index.referrers("u", "link").length === 0, "and clears the one it left");
}

// An edges array naming the same target twice must still list the node once.
{
  const index = new ReferenceIndex<any>();
  const node = { name: "n" };
  index.set(node, [
    { id: "t", kind: "link" },
    { id: "t", kind: "link" },
  ]);
  assert(index.referrers("t", "link").length === 1, "a repeated edge attaches once");
  index.remove(node);
  assert(index.referrers("t", "link").length === 0, "and removing it leaves nothing");
}

console.log("\nall reference index checks passed");

/**
 * Self-check for merge child matching. Run by `npm run check`.
 *
 * The stakes: a child wrongly reported as `extra` is one the caller is invited to delete, and
 * a child wrongly matched updates the wrong node in place.
 */
import { planMerge } from "./merge_children";

function assert(ok: unknown, msg: string): void {
  if (!ok) throw new Error("FAILED: " + msg);
  console.log("  ok -", msg);
}

const names = (nodes: Array<{ name?: string; id?: string }>) => nodes.map((n) => n.name ?? n.id).join(",");

console.log("\nmerge child matching");

// The regenerate loop: same generator, same deterministic ids, one entry renamed.
{
  const existing = [
    { id: "1", name: "Bolter" },
    { id: "2", name: "Chainsword" },
  ];
  const incoming = [
    { id: "1", name: "Bolter" },
    { id: "2", name: "Chainsword (Master-crafted)" },
  ];
  const plan = planMerge(existing, incoming);
  assert(plan.pairs.length === 2, "regenerating with unchanged ids updates in place");
  assert(plan.added.length === 0 && plan.extra.length === 0, "nothing is added or reported extra");
  assert(plan.pairs[1].existing.name === "Chainsword", "a renamed child still matches on its id");
}

// The reason additive is the default: a hand-made child must survive a regeneration.
{
  const existing = [
    { id: "1", name: "Bolter" },
    { id: "hand", name: "Hand-added option" },
  ];
  const plan = planMerge(existing, [{ id: "1", name: "Bolter" }]);
  assert(plan.pairs.length === 1, "the generated child is matched");
  assert(names(plan.extra) === "Hand-added option", "the hand-added child is reported, not matched away");
}

// A generator that emits no ids has only names to go on.
{
  const existing = [
    { id: "1", name: "Bolter", typeName: "Weapon" },
    { id: "2", name: "Bolter", typeName: "Model" },
  ];
  const incoming = [{ name: "Bolter", typeName: "Model" }];
  const plan = planMerge(existing, incoming);
  assert(plan.pairs.length === 1, "without ids, children match on typeName/name");
  assert(plan.pairs[0].existing.id === "2", "typeName disambiguates two children sharing a name");
  assert(names(plan.extra) === "Bolter", "the other one is reported extra, not overwritten");
}

// An incoming id never seen before is new, even when a name-alike is sitting there.
{
  const plan = planMerge([{ id: "old", name: "Bolter" }], [{ id: "new", name: "Bolter" }]);
  assert(plan.added.length === 1 && plan.extra.length === 1, "a changed id is an add plus an extra");
  assert(plan.pairs.length === 0, "ids are not second-guessed by falling back to the name");
}

// Duplicates on both sides: the dangerous case, where a naive index loses one silently.
{
  const existing = [
    { id: "a", name: "Bolter" },
    { id: "b", name: "Bolter" },
    { id: "c", name: "Bolter" },
  ];
  const incoming = [{ name: "Bolter" }, { name: "Bolter" }];
  const plan = planMerge(existing, incoming);
  assert(plan.pairs.length === 2, "two incoming children consume two distinct existing ones");
  assert(plan.pairs[0].existing.id === "a" && plan.pairs[1].existing.id === "b", "each match is used once");
  assert(names(plan.extra) === "Bolter" && plan.extra.length === 1, "the third is reported once, not thrice");
}

// A custom key is the escape hatch for a generator whose ids are not stable.
{
  const existing = [{ id: "x", name: "Bolter", comment: "unit/bolter" }];
  const incoming = [{ id: "y", name: "Renamed", comment: "unit/bolter" }];
  const plan = planMerge(existing, incoming, (n) => n.comment);
  assert(plan.pairs.length === 1, "a key callback overrides both id and name matching");
  assert(plan.extra.length === 0 && plan.added.length === 0, "and nothing falls through");
}

// Degenerate inputs, since a generator emitting an empty array is normal.
{
  const plan = planMerge([{ id: "1", name: "Bolter" }], []);
  assert(plan.extra.length === 1 && plan.added.length === 0, "an empty generated array reports, deletes nothing");
  const empty = planMerge<{ id: string }, { id: string }>([], []);
  assert(empty.pairs.length + empty.added.length + empty.extra.length === 0, "both empty is a no-op");
}

console.log("\nall ok");

/**
 * Checks for patch_review.ts. Run by `npm run check`.
 *
 * Fixtures are plain objects with `parent` set by hand: the review only reads fields, child arrays
 * and `parent`, and replays edits through whatever store it is given.
 */
import type { PatchIndex } from "~/assets/shared/battlescribe/bs_helpers";
import {
  applyChanges,
  diffJson,
  diffText,
  entryStatus,
  findTargets,
  listEntries,
  parseReview,
  previewTarget,
  serializeReview,
  type EditPath,
  type Json,
  type PatchEntryInfo,
} from "./patch_review";

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log("  ok -", msg);
  } else {
    failures++;
    console.log("  NOT OK -", msg);
  }
}

function withParents(node: Json, parent?: Json): Json {
  if (parent) node.parent = parent;
  for (const [key, value] of Object.entries(node)) {
    if (key !== "parent" && Array.isArray(value)) for (const child of value) withParents(child as Json, node);
  }
  return node;
}

function catalogue(): Json {
  return withParents({
    id: "cat",
    name: "Cat",
    sharedSelectionEntries: [
      {
        id: "cap",
        name: "Captain",
        costs: [{ name: "pts", typeId: "points", value: 80 }],
        associations: [
          {
            id: "lead",
            name: "Leading",
            conditionGroups: [{ type: "or", conditions: [{ childId: "tac", type: "instanceOf" }, { childId: "vvs", type: "instanceOf" }] }],
          },
        ],
        modifiers: [{ type: "decrement", field: "max1", value: 1 }],
      },
    ],
  });
}

function walk(root: Json) {
  return (cb: (node: Json) => void) => {
    const stack = [root];
    while (stack.length) {
      const node = stack.pop()!;
      cb(node);
      for (const [key, value] of Object.entries(node)) {
        if (key !== "parent" && Array.isArray(value)) stack.push(...(value as Json[]));
      }
    }
  };
}

/** A store that edits plain objects, recording what it was asked to do. */
function fakeStore(): EditPath<Json> & { log: string[] } {
  const log: string[] = [];
  return {
    log,
    undoStackPos: 0,
    set_field(node, key, value) {
      node[key] = value;
      log.push(`set ${key}`);
      return true;
    },
    async add(data, key, parent) {
      const arr = (parent[key] ??= []) as Json[];
      arr.push(withParents(data, parent));
      log.push(`add ${key}`);
    },
    async remove(node) {
      const parent = node.parent as Json;
      for (const value of Object.values(parent)) {
        if (Array.isArray(value) && value.includes(node)) value.splice(value.indexOf(node), 1);
      }
      log.push("remove");
    },
    collapse_undo() {},
    end_field_edit() {},
  };
}

function setup(patch: PatchIndex) {
  const root = catalogue();
  const { merged, entries } = listEntries([{ name: "patch.json", patch }]);
  const targets = findTargets(walk(root), merged);
  const preview = (info: PatchEntryInfo, approved = false) => (targets.get(info.key) ?? []).map((t) => previewTarget(t, merged, info, approved));
  return { root, merged, entries, targets, preview };
}

async function main() {
  console.log("patch_review");

  {
    const { entries, preview, root } = setup({ id: { cap: { $note: "MFM", costs: [{ name: "pts", typeId: "points", value: 90 }] } } } as PatchIndex);
    assert(entries[0].note === "MFM" && entries[0].ops.join() === "set", "lists the note and the kinds of an entry");
    const [target] = preview(entries[0]);
    const set = target.changes.find((c) => c.kind === "set");
    assert(target.status === "applies" && set?.key === "value" && set.before === 80 && set.after === 90, "a replaced costs array diffs down to the one value that moved");
    const store = fakeStore();
    await applyChanges(store, target.changes);
    const cap = (root.sharedSelectionEntries as Json[])[0];
    assert(((cap.costs as Json[])[0].value as number) === 90 && store.log.join() === "set value", "approving edits the live cost in place");
    assert(preview(entries[0])[0].status === "in-data", "once applied the entry reads as in data");
  }

  {
    const patch = { id: { cap: { $patchPush: { modifiers: { type: "floor", field: "max1", value: 0 } } } } } as PatchIndex;
    const { entries, preview, root } = setup(patch);
    const [target] = preview(entries[0]);
    assert(target.changes.length === 1 && target.changes[0].kind === "add", "a push is one add");
    await applyChanges(fakeStore(), target.changes);
    const again = preview(entries[0])[0];
    assert(again.status === "in-data" && again.changes[0].present === true, "a push already present is not added twice");
    const store = fakeStore();
    await applyChanges(store, again.changes);
    assert(store.log.length === 0 && ((root.sharedSelectionEntries as Json[])[0].modifiers as Json[]).length === 2, "re-approving changes nothing");
  }

  {
    const patch = { id: { lead: { $patchRemove: { "conditionGroups.conditions": { childId: "vvs" } } } } } as PatchIndex;
    const { entries, preview } = setup(patch);
    const [target] = preview(entries[0]);
    assert(target.changes.length === 1 && target.changes[0].kind === "remove" && (target.changes[0].element?.childId as string) === "vvs", "a nested removal points at the live condition");
    await applyChanges(fakeStore(), target.changes);
    assert(preview(entries[0])[0].status === "stale", "a removal with nothing left is stale while pending");
    assert(preview(entries[0], true)[0].status === "in-data", "and in data once approved");
  }

  {
    const patch = { id: { lead: { $patchUpdate: { "conditionGroups.conditions": { $match: { childId: "vvs" }, childId: "sob" } } } } } as PatchIndex;
    const { entries, preview } = setup(patch);
    const [target] = preview(entries[0]);
    assert(target.changes.length === 1 && target.changes[0].key === "childId" && target.changes[0].after === "sob", "an update is a set on the matched element");
    await applyChanges(fakeStore(), target.changes);
    assert(preview(entries[0])[0].status === "in-data", "an applied update is in data, not stale");
  }

  {
    const patch = { id: { lead: { $expect: { name: "Leading" }, name: "Supporting" } } } as PatchIndex;
    const { entries, preview } = setup(patch);
    const [target] = preview(entries[0]);
    assert(target.status === "applies", "$expect that holds applies");
    await applyChanges(fakeStore(), target.changes);
    assert(preview(entries[0])[0].status === "in-data", "an applied $expect entry reads as in data");
  }

  {
    const { entries, preview } = setup({ id: { lead: { $expect: { name: "Led by" }, name: "Supporting" } } } as PatchIndex);
    const [target] = preview(entries[0]);
    assert(target.status === "stale" && target.changes.length === 0 && target.issues.length === 1, "a failed $expect is stale and changes nothing");
  }

  {
    const { entries, targets } = setup({ id: { gone: { name: "x" } } } as PatchIndex);
    assert(entryStatus((targets.get(entries[0].key) ?? []).map(() => ({}) as never)) === "no-match", "an entry with no target is dead");
  }

  {
    const { entries } = listEntries([
      { name: "patch.json", patch: { id: { cap: { $patchPush: { modifiers: [{ type: "a" }] } } } } as PatchIndex },
      { name: "patch.mfm.json", patch: { id: { cap: { $patchPush: { modifiers: [{ type: "b" }] } } } } as PatchIndex },
    ]);
    assert(entries.length === 1 && entries[0].files.join() === "patch.json,patch.mfm.json", "entries merged across files keep both file names");
  }

  {
    const segments = diffText("You can target it for 0CP", "You can target it for -1CP");
    assert(segments.some((s) => s.kind === "del" && s.text === "0CP") && segments.some((s) => s.kind === "add" && s.text === "-1CP"), "text diff isolates the changed word");
    const lines = diffJson({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9 }, { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 10 }, 1);
    assert(lines[0].kind === "gap" && lines.filter((l) => l.kind === "add").length === 1, "json diff folds the unchanged lines");
  }

  {
    const text = serializeReview({ version: 1, decisions: { "id=b": { status: "rejected", date: "d", fingerprint: "f" }, "id=a": { status: "approved", date: "d", fingerprint: "f" } } });
    assert(text.indexOf("id=a") < text.indexOf("id=b") && Object.keys(parseReview(text).decisions).length === 2, "review file round-trips with sorted keys");
  }

  if (failures) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log("\nall ok");
}

void main();

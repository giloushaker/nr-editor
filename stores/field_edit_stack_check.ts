/**
 * Self-check for undo coalescing. Run with `npm run check:diagnostics` (it builds both checks).
 */
import { continuesFieldEdit, fieldEditType, type FieldEditMark } from "./field_edit_stack";

function assert(ok: unknown, msg: string): void {
  if (!ok) throw new Error("FAILED: " + msg);
  console.log("  ok -", msg);
}

const node = { id: "a" };
const other = { id: "b" };
const COALESCE = 700;

const mark = (over: Partial<FieldEditMark> = {}): FieldEditMark => ({
  node,
  key: "name",
  at: 1000,
  from: "original",
  stackPos: 3,
  ...over,
});

const req = (over: Partial<Parameters<typeof continuesFieldEdit>[1]> = {}) => ({
  node,
  key: "name",
  now: 1100,
  stackPos: 3,
  topType: fieldEditType("name"),
  coalesceMs: COALESCE,
  ...over,
});

console.log("\nfield edit coalescing");

assert(continuesFieldEdit(mark(), req()), "same node, key and stack within the window keeps one entry");
assert(!continuesFieldEdit(null, req()), "the first edit of a session starts a new entry");
assert(!continuesFieldEdit(mark(), req({ node: other })), "a different node starts a new entry");
assert(!continuesFieldEdit(mark(), req({ key: "comment" })), "a different field starts a new entry");

// Typing, pausing, then typing again should be two undo steps, not one.
assert(!continuesFieldEdit(mark(), req({ now: 1000 + COALESCE })), "a pause at the window edge starts a new entry");
assert(continuesFieldEdit(mark(), req({ now: 1000 + COALESCE - 1 })), "just inside the window still coalesces");

// If undo/redo or any other action moved the stack, the burst's entry is no longer on top:
// merging into it would rewrite an unrelated action.
assert(!continuesFieldEdit(mark(), req({ stackPos: 4 })), "an undo/redo in between starts a new entry");
assert(
  !continuesFieldEdit(mark(), req({ topType: "add" })),
  "another action landing on top starts a new entry",
);
assert(!continuesFieldEdit(mark(), req({ topType: undefined })), "an empty stack starts a new entry");

console.log("\nall field edit coalescing checks passed");

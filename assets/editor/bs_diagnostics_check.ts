/**
 * Self-check for the diagnostics engine. Run with `npm run check:diagnostics`.
 *
 * The engine takes its rules as an argument and reaches the catalogue only through
 * addError/removeError, so this exercises it against stubs -- no catalogue, no BattleScribe
 * data, no test framework. Asserts only; a failure throws and the script exits non-zero.
 */
import { runDiagnostics, clearDiagnostics, DiagnosticStore, type Diagnostic } from "./bs_diagnostics_engine";

function assert(ok: unknown, msg: string): void {
  if (!ok) throw new Error("FAILED: " + msg);
  console.log("  ok -", msg);
}

/** Minimal stand-in for an EditorBase carrying errors, plus the two catalogue methods used. */
function makeNode(id: string, extra: Record<string, unknown> = {}): any {
  const node: any = {
    id,
    editorTypeName: "selectionEntry",
    errors: undefined,
    getName: () => id,
    ...extra,
  };
  node.getCatalogue = () => catalogue;
  return node;
}

const catalogue: any = {
  addError(node: any, error: any) {
    catalogue.removeError(node, error.id);
    (node.errors ||= []).push(error);
  },
  removeError(node: any, id: string) {
    if (node.errors) node.errors = node.errors.filter((e: any) => e.id !== id);
  },
};

const ctx: any = {
  catalogue,
  findById: () => undefined,
  findByIdGlobal: () => undefined,
  hasPossibleParent: () => false,
  idCollisions: () => [],
};

const ids = (node: any) => (node.errors || []).map((e: any) => e.id).sort();

console.log("diagnostics engine");

// A rule that finds something records it under its own id, with its own severity.
{
  const rule: Diagnostic = {
    id: "always",
    severity: "warning",
    applies: () => true,
    check: () => "bad",
  };
  const node = makeNode("a");
  runDiagnostics(node, ctx, [rule]);
  assert(node.errors.length === 1, "a failing rule adds one error");
  assert(node.errors[0].msg === "bad", "the message comes from the rule");
  assert(node.errors[0].severity === "warning", "severity falls back to the rule's default");
}

// ...and clears it again once the node is fine, with no removeError call from the rule.
{
  let failing = true;
  const rule: Diagnostic = { id: "toggles", applies: () => true, check: () => (failing ? "bad" : undefined) };
  const node = makeNode("b");
  runDiagnostics(node, ctx, [rule]);
  assert(node.errors.length === 1, "rule reports while the node is bad");
  failing = false;
  runDiagnostics(node, ctx, [rule]);
  assert(node.errors.length === 0, "rule clears itself once the node is fine");
}

// The regression that motivated the registry: refreshErrors used to wipe every error on a
// node, so checks owned by other code vanished until a reload.
{
  const rule: Diagnostic = { id: "mine", applies: () => true, check: () => undefined };
  const node = makeNode("c");
  node.errors = [{ id: "someone-elses", msg: "keep me" }];
  runDiagnostics(node, ctx, [rule]);
  assert(ids(node).join() === "someone-elses", "a rule never touches errors it does not own");
}

// One broken rule must not silently take the rest down with it.
{
  const boom: Diagnostic = {
    id: "boom",
    applies: () => true,
    check: () => {
      throw new Error("rule is broken");
    },
  };
  const fine: Diagnostic = { id: "fine", applies: () => true, check: () => "still ran" };
  const node = makeNode("d");
  const errs = console.error;
  console.error = () => {};
  runDiagnostics(node, ctx, [boom, fine]);
  console.error = errs;
  assert(ids(node).join() === "fine", "a throwing rule is isolated, later rules still run");
}

// applies() gates check() so unrelated nodes cost nothing.
{
  let checked = 0;
  const rule: Diagnostic = {
    id: "gated",
    applies: (n: any) => n.id === "yes",
    check: () => {
      checked++;
      return undefined;
    },
  };
  runDiagnostics(makeNode("no"), ctx, [rule]);
  assert(checked === 0, "applies() false skips check() entirely");
  runDiagnostics(makeNode("yes"), ctx, [rule]);
  assert(checked === 1, "applies() true runs check()");
}

// Pair diagnostics: changing one node revalidates the other, and the cascade stops there.
// This is the re-entrancy bound -- related() pointing back must not recurse forever.
{
  const left = makeNode("left");
  const right = makeNode("right");
  let runs = 0;
  const rule: Diagnostic = {
    id: "pair",
    applies: () => true,
    check: () => {
      runs++;
      return undefined;
    },
    related: (n: any) => (n === left ? [right] : [left]),
  };
  runDiagnostics(left, ctx, [rule]);
  assert(runs === 2, `mutual related() settles in exactly 2 runs, got ${runs}`);
}

// clearDiagnostics removes what the rules own and leaves the rest.
{
  const rules: Diagnostic[] = [
    { id: "r1", applies: () => true, check: () => "x" },
    { id: "r2", applies: () => true, check: () => "y" },
  ];
  const node = makeNode("e");
  runDiagnostics(node, ctx, rules);
  node.errors.push({ id: "external", msg: "keep" });
  clearDiagnostics(node, catalogue, rules);
  assert(ids(node).join() === "external", "clearDiagnostics spares errors the rules do not own");
}

// related() only speaks for rules that apply to the node -- otherwise every rule would
// cascade from every node it was handed.
{
  let cascaded = 0;
  const rule: Diagnostic = {
    id: "scoped-cascade",
    applies: (n: any) => n.id === "applies",
    check: () => undefined,
    related: () => {
      cascaded++;
      return [];
    },
  };
  runDiagnostics(makeNode("skipped"), ctx, [rule]);
  assert(cascaded === 0, "related() is not consulted for a rule that does not apply");
  runDiagnostics(makeNode("applies"), ctx, [rule]);
  assert(cascaded === 1, "related() is consulted for a rule that applies");
}

console.log("\ndiagnostic store");

// Counts are maintained as errors move, so the tree badge never walks the list.
{
  const store = new DiagnosticStore<any>();
  const a = { name: "a" };
  const b = { name: "b" };
  store.set(a, "r1", { msg: "boom", severity: "error" });
  store.set(a, "r2", { msg: "hmm", severity: "warning" });
  store.set(b, "r1", { msg: "boom", severity: "error" });
  assert(store.count() === 3, "count() totals every severity");
  assert(store.count("error") === 2, "count() filters by severity");
  assert(store.for(a).length === 2, "a node reports its own errors");
}

// A rule replacing its own message must not leave the old count behind.
{
  const store = new DiagnosticStore<any>();
  const node = { name: "n" };
  store.set(node, "r", { msg: "first", severity: "error" });
  store.set(node, "r", { msg: "second", severity: "warning" });
  assert(store.for(node).length === 1, "a rule keeps one error under its id");
  assert(store.count("error") === 0 && store.count("warning") === 1, "replacing retallies the severity");
}

// Reporting the same thing again is a no-op, so a rule re-running costs nothing.
{
  const store = new DiagnosticStore<any>();
  const node = { name: "n" };
  assert(store.set(node, "r", { msg: "same" }) === true, "the first report is a change");
  assert(store.set(node, "r", { msg: "same" }) === false, "an identical re-report changes nothing");
}

// Clearing drops the node and its counts.
{
  const store = new DiagnosticStore<any>();
  const node = { name: "n" };
  store.set(node, "r", { msg: "x", severity: "error" });
  store.set(node, "r", undefined);
  assert(store.count() === 0, "clearing a rule's error drops its count");
  assert(store.for(node).length === 0, "and the node reports none");
  store.set(node, "r", { msg: "x" });
  store.clear(node);
  assert(store.count() === 0 && store.for(node).length === 0, "clear() empties the node");
}

// The flat list is derived and cached, but must not go stale.
{
  const store = new DiagnosticStore<any>();
  const node = { name: "n" };
  store.set(node, "r", { msg: "one" });
  const first = store.all();
  assert(first.length === 1, "all() lists what is stored");
  assert(store.all() === first, "all() is cached while nothing moves");
  store.set(node, "r2", { msg: "two" });
  assert(store.all().length === 2, "all() rebuilds once something changes");
}

// Unloading a catalogue drops its nodes without disturbing the rest.
{
  const store = new DiagnosticStore<any>();
  const mine = { cat: "A" };
  const theirs = { cat: "B" };
  store.set(mine, "r", { msg: "x" });
  store.set(theirs, "r", { msg: "y" });
  store.purge((n: any) => n.cat === "A");
  assert(store.count() === 1 && store.for(theirs).length === 1, "purge only drops the matching nodes");
}

console.log("\nall diagnostics engine checks passed");

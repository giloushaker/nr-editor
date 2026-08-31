/**
 * Checks for the rules in bs_diagnostics.ts. Run by `npm run check`.
 *
 * Separate from bs_diagnostics_check.ts, which exercises the engine against stubs and is
 * compiled standalone by tsc. The rules import the real bs_main/bs_condition through `~`, so
 * they need vite-node and the alias config, the same reason bs_search_check.ts runs there.
 *
 * What is worth checking here is the text a rule produces: a diagnostic that says the wrong
 * thing is worse than one that says nothing, and nothing else in the repo reads these strings.
 */
import { DIAGNOSTICS, registerDiagnostic, unregisterDiagnostic } from "./bs_diagnostics";

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log("  ok -", msg);
  } else {
    failures++;
    console.log("  NOT OK -", msg);
  }
}

const rule = DIAGNOSTICS.find((d) => d.id === "no-target")!;

/** Runs the rule the way the engine does, and flattens whatever shape it returned to a string. */
function check(node: unknown, findByIdGlobal: (id: string) => unknown): string | undefined {
  const ctx = { catalogue: home, findById: () => undefined, findByIdGlobal, isCyclicLink: () => false, idCollisions: () => [] };
  const found = rule.check(node as never, ctx as never) || undefined;
  return typeof found === "string" ? found : found?.msg;
}

const home = { name: "Warriors of Chaos" };
const other = { name: "Beastmen Brayherds" };
const link = (extra: Record<string, unknown> = {}) => ({
  name: "Mark of Chaos Undivided",
  editorTypeName: "infoLink",
  isLink: () => true,
  ...extra,
});
/** A node the global lookup can return: the rule asks it which file it lives in. */
const nodeIn = (catalogue: unknown) => ({ getCatalogue: () => catalogue });

console.log("no-target");
{
  assert(check(link({ target: {} }), () => undefined) === undefined, "a resolved link reports nothing");

  // No targetId at all: nothing to say beyond the fact that it is dead.
  assert(
    check(link(), () => undefined) === "(infoLink) Mark of Chaos Undivided has no target",
    "a link with no targetId keeps the plain message"
  );

  // The id resolves nowhere in the system either -- genuinely deleted, so the plain message again.
  assert(
    check(link({ targetId: "gone" }), () => undefined) === "(infoLink) Mark of Chaos Undivided has no target",
    "an id that exists nowhere keeps the plain message"
  );

  // The whole point: the id is alive in a file this catalogue does not import.
  assert(
    check(link({ targetId: "595-bbd0" }), () => nodeIn(other)) ===
      '(infoLink) Mark of Chaos Undivided has no target: id 595-bbd0 is in "Beastmen Brayherds", which this catalogue does not import',
    "an id living elsewhere names the catalogue that has it"
  );

  // Same file: a different bug (bad-link-target owns it), so this rule must not blame an import.
  assert(
    check(link({ targetId: "595-bbd0" }), () => nodeIn(home)) === "(infoLink) Mark of Chaos Undivided has no target",
    "an id in this same catalogue does not get the import message"
  );

  // findByIdGlobal can answer with a catalogue stub that has no getCatalogue; must not throw.
  assert(
    check(link({ targetId: "595-bbd0" }), () => ({})) === "(infoLink) Mark of Chaos Undivided has no target",
    "a lookup result that is not a node is ignored rather than throwing"
  );
}

/**
 * A script's diagnostics go into this same array, so what matters is that adding one lands it
 * where the engine will actually run it, that re-adding the same id replaces rather than
 * duplicates (a watched script file reloads on every save), and that removing it puts the list
 * back exactly as it was.
 */
console.log("\nregister / unregister");
{
  const before = DIAGNOSTICS.length;
  const rule = { id: "check-only", applies: () => true, check: () => "nope" };

  registerDiagnostic(rule);
  assert(DIAGNOSTICS.length === before + 1, "registering adds one rule");
  assert(DIAGNOSTICS[DIAGNOSTICS.length - 1] === rule, "the rule is in the list the engine runs");

  const replacement = { ...rule, check: () => "different" };
  registerDiagnostic(replacement);
  assert(DIAGNOSTICS.length === before + 1, "re-registering the same id replaces rather than appends");
  assert(DIAGNOSTICS.filter((o) => o.id === "check-only")[0] === replacement, "the replacement is what stays");

  assert(unregisterDiagnostic("check-only") === replacement, "unregistering hands back the rule it removed");
  assert(DIAGNOSTICS.length === before, "unregistering leaves the list as it was");
  assert(unregisterDiagnostic("check-only") === undefined, "unregistering an unknown id is a no-op");

  // A script's rule must not be able to displace a built-in by claiming its id and leaving.
  assert(
    DIAGNOSTICS.some((o) => o.id === "no-target"),
    "the built-in rules are still registered afterwards"
  );
}

console.log(failures ? `\n${failures} FAILED` : "\nall ok");
if (failures) process.exit(1);

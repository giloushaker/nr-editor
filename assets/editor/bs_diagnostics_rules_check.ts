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
import { DIAGNOSTICS } from "./bs_diagnostics";

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
  const found = rule.check(node as never, ctx as never);
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

console.log(failures ? `\n${failures} FAILED` : "\nall ok");
if (failures) process.exit(1);

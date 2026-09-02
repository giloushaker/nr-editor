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
 * Catalogue import loops.
 *
 * The chain in the message is the whole value of this one -- the link that closes a loop is
 * usually in a file nobody had open -- so that is what is checked. The other half of the check
 * is that a loop somewhere else in the graph does not get blamed on an innocent link, and does
 * not send the walk round forever.
 */
console.log("\ncatalogue-link-cycle");
{
  const rule = DIAGNOSTICS.find((d) => d.id === "catalogue-link-cycle")!;
  const cat = (id: string, name: string) => ({ id, name, catalogueLinks: [] as Array<{ target: unknown }> });
  /** Fills in catalogueLinks after the fact, so loops can be tied. */
  const imports = <T extends ReturnType<typeof cat>>(from: T, ...targets: unknown[]) => {
    for (const target of targets) from.catalogueLinks.push({ target });
    return from;
  };
  /** The node the rule sees: a link sitting in `catalogue`, pointing at `target`. */
  const node = (from: unknown, target?: unknown) => ({ editorTypeName: "catalogueLink", catalogue: from, target });
  const run = (n: unknown) => {
    const found = rule.check(n as never, {} as never) || undefined;
    return typeof found === "string" ? found : found?.msg;
  };

  assert(rule.applies(node(cat("a", "A"), cat("b", "B"))), "the rule looks at catalogue links");
  assert(!rule.applies({ editorTypeName: "entryLink", isLink: () => true }), "and at nothing else");

  {
    const militia = cat("f477", "Imperialis Militia");
    const weapons = cat("a22d", "Weapons");
    imports(militia, weapons);
    assert(run(node(militia, weapons)) === undefined, "a plain import reports nothing");
    assert(run(node(militia)) === undefined, "an unresolved link is left to the no-target rule");
  }

  {
    const militia = cat("f477", "Imperialis Militia");
    const auxilia = cat("7851", "Solar Auxilia");
    imports(militia, auxilia);
    imports(auxilia, militia);
    const expected = "Recursive catalogue link: Imperialis Militia -> Solar Auxilia -> Imperialis Militia";
    assert(run(node(militia, auxilia)) === expected, "a two-file loop names both files and closes the chain");
    assert(
      run(node(auxilia, militia)) === "Recursive catalogue link: Solar Auxilia -> Imperialis Militia -> Solar Auxilia",
      "and reports from the other side too, since either link could be the wrong one"
    );
  }

  {
    // Padded names are normal in this data -- faction files indent their own name for sorting.
    const a = cat("a", "Alpha Legion");
    const b = cat("b", "     XX - Alpha Legion Rites");
    const c = cat("c", "Shattered Legions");
    imports(a, b);
    imports(b, c);
    imports(c, a);
    assert(
      run(node(a, b)) === "Recursive catalogue link: Alpha Legion -> XX - Alpha Legion Rites -> Shattered Legions -> Alpha Legion",
      "a loop through a third file walks the whole way round, with names trimmed"
    );
  }

  {
    const self = cat("s", "Wargear");
    imports(self, self);
    assert(run(node(self, self)) === "Recursive catalogue link: Wargear -> Wargear", "a catalogue linking itself is a loop");
  }

  {
    // The loop is between b and c; a merely imports b. Blaming a's link would send someone
    // editing the wrong file, and an unguarded walk would never come back.
    const a = cat("a", "Iron Hands");
    const b = cat("b", "Mechanicum");
    const c = cat("c", "Mech Library");
    imports(a, b);
    imports(b, c);
    imports(c, b);
    assert(run(node(a, b)) === undefined, "a loop further down the graph is not blamed on the link above it");
    assert(run(node(b, c)) === "Recursive catalogue link: Mechanicum -> Mech Library -> Mechanicum", "and is still reported where it is");
  }
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

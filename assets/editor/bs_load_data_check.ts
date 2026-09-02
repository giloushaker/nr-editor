/**
 * Checks for the catalogue-link loop guard in bs_load_data. Run by `npm run check`.
 *
 * Lives here rather than next to the loader because assets/shared is a submodule, and runs
 * under vite-node for the `~` alias, the same as the other rule checks.
 *
 * What is worth checking is that a loop terminates at all: a catalogue is registered with the
 * manager only once its own links have resolved, so before the guard, two files importing each
 * other loaded each other forever and took the editor down with them.
 */
import { BSCatalogueManager } from "~/assets/shared/battlescribe/bs_system";
import { loadData } from "~/assets/shared/battlescribe/bs_load_data";
import type { BSICatalogueLink, BSIData } from "~/assets/shared/battlescribe/bs_types";

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log("  ok -", msg);
  } else {
    failures++;
    console.log("  NOT OK -", msg);
  }
}

const SYSTEM_ID = "sys";
const system = { gameSystem: { id: SYSTEM_ID, name: "System", type: "gameSystem" } } as unknown as BSIData;

function file(id: string, name: string, targets: string[]): BSIData {
  return {
    catalogue: {
      id,
      name,
      type: "catalogue",
      gameSystemId: SYSTEM_ID,
      catalogueLinks: targets.map((targetId, i) => ({ id: `${id}-${i}`, name: targetId, targetId, type: "catalogue" })),
    },
  } as unknown as BSIData;
}

/** A manager whose whole job is to hand back files by id. */
class Files extends BSCatalogueManager {
  constructor(private files: Record<string, BSIData>) {
    super();
  }
  override async getData(link: BSICatalogueLink): Promise<BSIData> {
    const found = this.files[link.targetId!];
    if (!found) throw Error(`no such file: ${link.targetId}`);
    return found;
  }
}

/** Runs a load with console.error captured, since the loop report is part of what is checked. */
async function load(files: Record<string, BSIData>, entry: string) {
  const manager = new Files(files);
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args.join(" "));
  try {
    const loaded = await loadData(manager, files[entry]!);
    return { loaded: loaded as unknown as { id: string }, errors };
  } finally {
    console.error = original;
  }
}

const links = (catalogue: unknown) => (catalogue as { catalogueLinks?: Array<{ target?: { id: string } }> }).catalogueLinks || [];

console.log("catalogue link loops");
{
  // A imports B, B imports A: the case that hung the editor on Horus Heresy 3rd Edition.
  const { loaded, errors } = await load({ [SYSTEM_ID]: system, a: file("a", "A", ["b"]), b: file("b", "B", ["a"]) }, "a");
  const b = links(loaded)[0]!.target!;
  assert(b.id === "b", "the load finishes and resolves the outward link");
  assert(links(b)[0]!.target === loaded, "the link back points at the in-progress catalogue itself");
  assert(errors.length === 1 && errors[0] === "Recursive catalogue link: A -> B -> A", "the loop is reported once, with the chain");
}

{
  // Nothing to do with a loop: two catalogues importing the same library, which the guard must
  // not mistake for one. Both sides have to end up with the same object -- the loader does not
  // deduplicate the read, but setPrototype fills the one raw file in place, so two resolutions
  // of the same id that produced two catalogues would mean half the links pointed at a copy.
  const { loaded } = await load(
    { [SYSTEM_ID]: system, a: file("a", "A", ["b", "c"]), b: file("b", "B", ["lib"]), c: file("c", "C", ["lib"]), lib: file("lib", "Weapons", []) },
    "a"
  );
  assert(links(loaded).every((link) => Boolean(link.target)), "a diamond resolves every link");
  const [viaB, viaC] = links(loaded).map((link) => links(link.target)[0]!.target);
  assert(Boolean(viaB) && viaB === viaC, "and both routes to the shared library land on the same catalogue");
}

{
  const { loaded, errors } = await load({ [SYSTEM_ID]: system, a: file("a", "A", ["a"]) }, "a");
  assert(links(loaded)[0]!.target === loaded, "a catalogue linking itself resolves to itself");
  assert(errors[0] === "Recursive catalogue link: A -> A", "and says so");
}

console.log(failures ? `\n${failures} FAILED` : "\nall ok");
if (failures) process.exit(1);

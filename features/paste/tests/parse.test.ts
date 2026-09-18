/**
 * The paste reader's checks. Each case is a profile type, the text as it was copied from a book,
 * and what must come out. Run: npm test
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PasteFailure, PasteSuccess, SetupProfileType } from "../model";
import { parsePaste } from "../parse";

// ---- profile types the cases read against --------------------------------------------------

/**
 * Each column says what its values look like (the format preset from features/setup/formats):
 * that is what the reader uses to tell a Range from a Strength and to fix OCR glyphs.
 */
const WEAPON_6E: SetupProfileType = {
  id: "weapon",
  name: "Weapon",
  kind: "weapon",
  columns: [
    { id: "range", name: "Range", format: { preset: "inches", empty: "-" } }, // 24", or - for melee
    { id: "s", name: "S", format: { preset: "text" } }, // 4, or "User", "x2"
    { id: "ap", name: "AP", format: { preset: "number", empty: "-" } },
    { id: "type", name: "Type", format: { preset: "text" } }, // "Rapid Fire, Gets Hot"
  ],
};
/** 6th edition model line: eight numbers and a save roll. */
const MODEL_6E: SetupProfileType = {
  id: "model",
  name: "Model",
  kind: "model",
  columns: [
    { id: "ws", name: "WS", format: { preset: "number" } },
    { id: "bs", name: "BS", format: { preset: "number" } },
    { id: "s", name: "S", format: { preset: "number" } },
    { id: "t", name: "T", format: { preset: "number" } },
    { id: "w", name: "W", format: { preset: "number" } },
    { id: "i", name: "I", format: { preset: "number" } },
    { id: "a", name: "A", format: { preset: "number" } },
    { id: "ld", name: "Ld", format: { preset: "number" } },
    { id: "sv", name: "Sv", format: { preset: "roll", empty: "-" } }, // 3+, or - for none
  ],
};

/** A type from an older file: columns with no format at all, so every value is plain text. */
const UNIT_10E: SetupProfileType = {
  id: "unit",
  name: "Unit",
  kind: "model",
  columns: ["M", "T", "SV", "W", "LD", "OC"].map((n) => ({ id: n.toLowerCase(), name: n, format: { preset: "text" } })),
};

function read(text: string, types = [MODEL_6E, WEAPON_6E]) {
  const r = parsePaste(text, types);
  if (r.ok === false) throw new Error("expected a read, got: " + r.reasons.join(" | "));
  return r as PasteSuccess;
}

// ---- rows: one stat line per text line -------------------------------------------------------

describe("rows", () => {
  it("clean copy with header, tabs between cells", () => {
    const s = read(`Weapon\tRange\tS\tAP\tType
Boltgun\t24"\t4\t5\tRapid Fire
Bolt pistol\t12"\t4\t5\tPistol
Flamer\tTemplate\t4\t5\tAssault 1`);
    expect(s.typeId).toBe("weapon");
    expect(s.layout).toBe("rows");
    expect(s.rows).toHaveLength(3);
    expect(s.rows[0]).toEqual({ name: "Boltgun", values: { range: '24"', s: "4", ap: "5", type: "Rapid Fire" }, flags: [], sub: false });
    // Template is not a distance: kept as written, flagged.
    expect(s.rows[2].values.range).toBe("Template");
    expect(s.rows[2].flags).toContainEqual({ columnId: "range", reason: "format" });
  });

  it("single spaces only, free text runs to the end of the line", () => {
    const s = read(`Heavy bolter 36" 5 4 Heavy 3
Lascannon 48" 9 2 Heavy 1
Plasma gun 24" 7 2 Rapid Fire, Gets Hot`);
    expect(s.typeId).toBe("weapon");
    expect(s.rows.map((r) => r.name)).toEqual(["Heavy bolter", "Lascannon", "Plasma gun"]);
    expect(s.rows[2].values.type).toBe("Rapid Fire, Gets Hot");
    expect(s.unread).toEqual([]);
  });

  it("model stat block, OCR glyphs fixed in number columns and marked guessed", () => {
    const s = read(`WS BS S T W I A Ld Sv
Legionnaire 4 4 4 4 l 4 I 8 3+
Legionnaire Sergeant 4 4 4 4 1 4 2 9 3+`);
    expect(s.typeId).toBe("model");
    expect(s.rows).toHaveLength(2);
    expect(s.rows[0].values.w).toBe("1");
    expect(s.rows[0].values.a).toBe("1");
    expect(s.rows[0].flags.every((f) => f.reason === "guessed")).toBe(true);
    expect(s.rows[1].name).toBe("Legionnaire Sergeant");
  });

  it("a two-word name before a free-text first column stays one name", () => {
    const FREE_RANGE: SetupProfileType = { ...WEAPON_6E, columns: WEAPON_6E.columns.map((c) => (c.id === "range" ? { ...c, format: { preset: "text" } } : c)) };
    const s = read(
      `Grenade launcher
- Frag grenade 24" 3 6 Assault 1, Blast
Storm bolter 24" 4 5 Assault 2`,
      [FREE_RANGE],
    );
    expect(s.rows.map((r) => r.name)).toEqual(["Grenade launcher", "Frag grenade", "Storm bolter"]);
    expect(s.rows[0].values).toEqual({});
    expect(s.rows[2].values).toEqual({ range: '24"', s: "4", ap: "5", type: "Assault 2" });
  });

  it("a column the type lacks (D) still reads; the row comes out wrong and visibly so", () => {
    // The reader cannot know the table has a column the type does not. The row is read, but its
    // cells are shifted, which the author sees in the preview and fixes by adding D to the type.
    const s = read(
      `Weapon Range S AP D Type
Boltgun 24" 4 5 1 Rapid Fire`,
      [WEAPON_6E],
    );
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].values.type).toBe("Rapid Fire");
  });
});

// ---- a whole codex table --------------------------------------------------------------------

describe("codex table", () => {
  const text = readFileSync(new URL("./inputs/6th-ed-ranged-weps.txt", import.meta.url), "utf8");
  it("every weapon reads; a name-only line is a group whose sub-lines carry the stats", () => {
    const s = read(text);
    expect(s.typeId).toBe("weapon");
    expect(s.unread).toEqual([]);
    const names = s.rows.map((r) => (r.sub ? "  " + r.name : r.name));
    expect(names).toContain("Grenade launcher");
    expect(names).toContain("  Frag grenade");
    expect(names).toContain("  Krak missile");
    const launcher = s.rows.find((r) => r.name === "Grenade launcher")!;
    expect(launcher.values).toEqual({});
    expect(launcher.flags).toEqual([]);
    const frag = s.rows[s.rows.indexOf(launcher) + 1];
    expect(frag.sub).toBe(true);
    expect(frag.values).toEqual({ range: '24"', s: "3", ap: "6", type: "Assault 1, Blast" });
    // "-" is the empty mark for Range and AP: not a flag.
    const gatling = s.rows.find((r) => r.name === "Taurox gatling cannon")!;
    expect(gatling.values.ap).toBe("-");
    expect(gatling.flags).toEqual([]);
    expect(s.rows.filter((r) => !r.sub)).toHaveLength(23);
  });
  it("a Description column keeps its text instead of dropping it", () => {
    const withLong: SetupProfileType = { ...WEAPON_6E, columns: WEAPON_6E.columns.map((c) => (c.id === "type" ? { ...c, format: { preset: "long" } } : c)) };
    const s = read(text, [withLong]);
    expect(s.rows.find((r) => r.name === "Hellstrike missile")!.values.type).toBe("Ordnance 1, One use only");
  });
});

// ---- blocks: a name, then its text -------------------------------------------------------------

describe("blocks", () => {
  const WARGEAR: SetupProfileType = {
    id: "wargear",
    name: "Wargear",
    kind: "ability",
    columns: [{ id: "desc", name: "Description", format: { preset: "long" } }],
  };
  it("a name line, then wrapped description lines, from the wargear section of a codex", () => {
    const text = readFileSync(new URL("./inputs/wargear-item.txt", import.meta.url), "utf8");
    const s = read(text, [MODEL_6E, WEAPON_6E, WARGEAR]);
    expect(s.typeId).toBe("wargear");
    expect(s.layout).toBe("blocks");
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].name).toBe("Power armour");
    // Line breaks from the page are gone; each sentence ends a line instead.
    expect(s.rows[0].values.desc.split("\n")).toEqual([
      "Made from thick ceramite plates and electronically motivated fibre bundles, power armour is amongst the best protective armour available to the servants of the Imperium.",
      "Power armour confers a 3+ Armour Save.",
    ]);
    expect(s.rows[0].flags).toEqual([]);
  });
  it("several items in a row; a short wrapped line is not taken for a name", () => {
    const s = read(
      `Bolt pistol
The bolt pistol is a smaller version of the boltgun, firing the same
deadly ammunition
at a shorter range.
Frag grenades
Frag grenades are thrown at the enemy before an assault.`,
      [WARGEAR],
    );
    expect(s.rows.map((r) => r.name)).toEqual(["Bolt pistol", "Frag grenades"]);
    expect(s.rows[0].values.desc).toBe("The bolt pistol is a smaller version of the boltgun, firing the same deadly ammunition at a shorter range.");
  });
});

// ---- columns: screen OCR reads a table one column after another ------------------------------

describe("columns", () => {
  it("OCR dump with damaged header words and a short column", () => {
    const s = read(`Wea on
Autocannon
Boltgun
Bolt pistol
Flamer
Grenade launcher
- Frag grenade
- Krak grenade
Ran e
48 v'
240
12"
Template
24"
s
7
4
4
4
3
3
6
AP
4
5
5
5
6
4
4
Heavy 2
Rapid Fire
Pistol
Assault I
Assault l, Blast
Assault l, Blast
Assault I`);
    expect(s.typeId).toBe("weapon");
    expect(s.layout).toBe("columns");
    expect(s.rows).toHaveLength(7);
    expect(s.rows[0].name).toBe("Autocannon");
    expect(s.rows[0].values.range).toBe('48"'); // 48 v'
    expect(s.rows[1].values.range).toBe('24"'); // 240
    expect(s.rows[5].sub && s.rows[6].sub).toBe(true);
    // The Range column stopped after five values: the last rows have no range.
    expect(s.rows[6].flags).toContainEqual({ columnId: "range", reason: "missing" });
    // The Type column lost its header; it is the tail after AP's numbers stop.
    expect(s.rows[0].values.type).toBe("Heavy 2");
    // Free text is never glyph-fixed.
    expect(s.rows[3].values.type).toBe("Assault I");
  });
});

// ---- which type -------------------------------------------------------------------------------

describe("which type", () => {
  const MELEE = { ...WEAPON_6E, id: "melee", name: "Melee Weapon" };
  it("the section's own type wins a tie between look-alike types", () => {
    const text = `Chainsword 12" 4 5 Melee`;
    expect(read(text, [WEAPON_6E, MELEE]).typeId).toBe("weapon");
    expect(parsePaste(text, [WEAPON_6E, MELEE], "melee")).toMatchObject({ ok: true, typeId: "melee" });
  });
  it("a clearly better fit still beats the section's type", () => {
    const text = `WS BS S T W I A Ld Sv
Legionnaire 4 4 4 4 1 4 1 8 3+`;
    expect(parsePaste(text, [MODEL_6E, WEAPON_6E], "weapon")).toMatchObject({ ok: true, typeId: "model" });
  });
});

// ---- columns with no format ------------------------------------------------------------------

describe("unformatted columns", () => {
  it("a stat line with no header and no name, pasted onto the model it belongs to", () => {
    const s = read(`12" 5 3+ 5 6+ 1`, [UNIT_10E]);
    expect(s.layout).toBe("rows");
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].name).toBe("");
    expect(s.rows[0].values).toEqual({ m: `12"`, t: "5", sv: "3+", w: "5", ld: "6+", oc: "1" });
    expect(s.rows[0].flags).toEqual([]);
  });
  it("a two-word name before the stats, with the header line above", () => {
    const s = read(`M T SV W LD OC\nSpace Marine 6" 4 3+ 2 6+ 1`, [UNIT_10E]);
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].name).toBe("Space Marine");
    expect(s.rows[0].values.oc).toBe("1");
  });
  it("beats a weapon type that would take the first value for a name", () => {
    const s = read(`12" 5 3+ 5 6+ 1`, [WEAPON_6E, UNIT_10E]);
    expect(s.typeId).toBe("unit");
  });
  it("forcing the type reads it even when it is not the best fit", () => {
    const r = parsePaste(`12" 5 3+ 5 6+ 1`, [UNIT_10E, MODEL_6E], "unit", "unit");
    expect(r.ok).toBe(true);
    expect((r as PasteSuccess).typeId).toBe("unit");
  });
});

// ---- no fit ---------------------------------------------------------------------------------

describe("no fit", () => {
  it("prose is refused with one reason per type and some hints", () => {
    const r = parsePaste(
      `The Legion of the Damned appear without warning, wreathed in ghostly flame.
Their origin is unknown; some say they are the ghosts of the Fire Hawks chapter.`,
      [MODEL_6E, WEAPON_6E],
    );
    expect(r.ok).toBe(false);
    const f = r as PasteFailure;
    expect(f.reasons).toHaveLength(2);
    expect(f.hints.length).toBeGreaterThanOrEqual(2);
  });

  it("empty paste", () => {
    const r = parsePaste("  \n ", [WEAPON_6E]);
    expect(r.ok).toBe(false);
  });
});

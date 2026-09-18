import type { ColumnFormat, ProfileKind } from "./model";

export interface PresetProfileType {
  name: string;
  kind: ProfileKind;
  columns: { name: string; format: ColumnFormat }[];
}
export interface Preset {
  name: string;
  profileTypes: PresetProfileType[];
}

type Col = { name: string; format: ColumnFormat };
const fmt = (preset: ColumnFormat["preset"], dash: boolean): ColumnFormat => (dash ? { preset, empty: "-" } : { preset });
// "-" for none is allowed everywhere by default; pass false for a column that is always set.
const num = (name: string, dash = true): Col => ({ name, format: fmt("number", dash) });
const roll = (name: string, dash = true): Col => ({ name, format: fmt("roll", dash) });
const dice = (name: string, dash = true): Col => ({ name, format: fmt("dice", dash) });
const inches = (name: string, dash = true): Col => ({ name, format: fmt("inches", dash) });
const text = (name: string): Col => ({ name, format: { preset: "text", empty: "-" } });

/** What a new system starts with when the author accepts step 2 as-is. */
export const SAMPLE: Preset = {
  name: "Sample",
  profileTypes: [
    {
      name: "Model",
      kind: "model",
      columns: [num("WS"), num("BS"), num("S"), num("T"), num("W"), num("I"), num("A"), num("Ld"), roll("Sv", true)],
    },
    {
      name: "Weapon",
      kind: "weapon",
      columns: [inches("Range", true), text("S"), num("AP", true), text("Type")],
    },
  ],
};

// ponytail: four games, hand-typed. A preset picker over the loaded systems' own profile types
// would replace this list if it ever grows past what fits on one screen.
export const PRESETS: Preset[] = [
  {
    name: "Warhammer 40,000 (3rd to 7th)",
    profileTypes: SAMPLE.profileTypes,
  },
  {
    name: "Warhammer 40,000 (10th)",
    profileTypes: [
      { name: "Unit", kind: "model", columns: [inches("M"), num("T"), roll("SV"), num("W"), roll("LD"), num("OC")] },
      {
        name: "Ranged Weapons",
        kind: "weapon",
        columns: [inches("Range"), dice("A"), roll("BS", true), num("S"), num("AP"), dice("D"), text("Keywords")],
      },
      {
        name: "Melee Weapons",
        kind: "weapon",
        columns: [inches("Range"), dice("A"), roll("WS"), num("S"), num("AP"), dice("D"), text("Keywords")],
      },
    ],
  },
  {
    name: "Age of Sigmar",
    profileTypes: [
      { name: "Unit", kind: "model", columns: [inches("Move"), num("Health"), roll("Save"), num("Control")] },
      {
        name: "Weapon",
        kind: "weapon",
        columns: [inches("Range", true), dice("Attacks"), roll("Hit"), roll("Wound"), num("Rend"), dice("Damage"), text("Ability")],
      },
    ],
  },
  {
    name: "The Old World",
    profileTypes: [
      { name: "Model", kind: "model", columns: [num("M"), num("WS"), num("BS"), num("S"), num("T"), num("W"), num("I"), num("A"), num("Ld")] },
      { name: "Weapon", kind: "weapon", columns: [text("R"), text("S"), num("AP", true), text("Special Rules")] },
    ],
  },
  {
    name: "Horus Heresy",
    profileTypes: [
      {
        name: "Model",
        kind: "model",
        columns: [inches("M"), num("WS"), num("BS"), num("S"), num("T"), num("W"), num("I"), num("A"), num("Ld"), roll("Sv", true)],
      },
      { name: "Weapon", kind: "weapon", columns: [inches("Range", true), text("S"), num("AP", true), text("Type")] },
    ],
  },
];

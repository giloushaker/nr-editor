/**
 * What a characteristic's values look like. One preset per common shape, each with the regex
 * behind it, so a data author picks "Dice" and never sees the pattern unless they pick Custom.
 */
import type { BSIValueFormat } from "~/assets/shared/battlescribe/bs_types";

export type FormatPreset = BSIValueFormat["preset"];
export type ColumnFormat = BSIValueFormat;

export interface PresetInfo {
  preset: FormatPreset;
  label: string;
  description: string;
  examples: string;
  pattern?: RegExp;
}

export const FORMAT_PRESETS: PresetInfo[] = [
  { preset: "number", label: "Number", description: "A whole number, negative allowed.", examples: "4, 10, -1", pattern: /^-?\d+$/ },
  { preset: "roll", label: "Roll", description: "A target on a die, written with a plus.", examples: "3+, 2+", pattern: /^\d\+$/ },
  { preset: "dice", label: "Dice or number", description: "Dice notation with an optional modifier, or a plain number.", examples: "D6, 2D6+1, D3, 3", pattern: /^(\d*D\d+([+-]\d+)?|\d+)$/i },
  { preset: "inches", label: "Inches", description: "A distance with the inch mark.", examples: '12", 6"', pattern: /^\d+(\.\d+)?"$/ },
  { preset: "choice", label: "One of a list", description: "Only the values you list, like a weapon's Melee or Ranged.", examples: "Melee, Ranged" },
  { preset: "text", label: "Free text", description: "A short phrase with spaces, on the stat line. Keep it last.", examples: "Assault 1, Melta" },
  { preset: "long", label: "Description", description: "A paragraph, like a rule's text. Shown under the stat line on its own row.", examples: "Any model with this rule may…" },
  { preset: "custom", label: "Custom pattern", description: "Your own regular expression, for the odd one out.", examples: "a regular expression" },
];

export const PRESET_BY_NAME = Object.fromEntries(FORMAT_PRESETS.map((p) => [p.preset, p])) as Record<FormatPreset, PresetInfo>;

/** The one-line summary shown on a column card: "Dice or number, or -". */
export function describeFormat(f: ColumnFormat): string {
  let base: string;
  if (f.preset === "choice") base = f.choices?.length ? f.choices.join(" / ") : "one of a list";
  else if (f.preset === "custom") base = f.pattern ? `/${f.pattern}/` : "custom pattern";
  else base = PRESET_BY_NAME[f.preset].examples;
  return f.empty ? `${base}, or ${f.empty}` : base;
}

/**
 * Whether `value` fits the format. Free text always does. A lone dash is "none" in every book
 * and is never a number, roll, dice or distance, so it always passes; `empty` is for another
 * symbol ("N/A", "∞") or for allowing a blank cell.
 */
export function matchesFormat(f: ColumnFormat, value: string): boolean {
  const v = value.trim();
  if (/^[-–—]$/.test(v)) return true;
  if (f.empty && (v === "" || v.toLowerCase() === f.empty.toLowerCase())) return true;
  switch (f.preset) {
    case "text":
    case "long":
      return true;
    case "choice":
      return (f.choices || []).some((c) => c.toLowerCase() === v.toLowerCase());
    case "custom":
      try {
        return f.pattern ? new RegExp(`^(?:${f.pattern})$`, "i").test(v) : true;
      } catch {
        return true;
      }
    default:
      return PRESET_BY_NAME[f.preset].pattern!.test(v);
  }
}

// ponytail: one runnable check for the patterns. `npx tsx features/setup/formats.ts`
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("formats.ts")) {
  const ok = (f: ColumnFormat, v: string) => console.assert(matchesFormat(f, v), `${describeFormat(f)} should accept ${v}`);
  const no = (f: ColumnFormat, v: string) => console.assert(!matchesFormat(f, v), `${describeFormat(f)} should reject ${v}`);
  ok({ preset: "number" }, "4");
  no({ preset: "number" }, "3+");
  ok({ preset: "number", empty: "-" }, "-");
  ok({ preset: "number", empty: "N/A" }, "n/a");
  no({ preset: "number" }, "-");
  ok({ preset: "roll" }, "3+");
  ok({ preset: "dice" }, "2D6+1");
  ok({ preset: "dice" }, "3");
  no({ preset: "dice" }, "3+");
  ok({ preset: "inches" }, '12"');
  ok({ preset: "choice", choices: ["Melee", "Ranged"] }, "melee");
  no({ preset: "choice", choices: ["Melee", "Ranged"] }, "Psychic");
  ok({ preset: "custom", pattern: "S(\\+\\d)?" }, "S+1");
  console.log("formats ok");
}

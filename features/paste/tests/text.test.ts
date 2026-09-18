import { describe, expect, it } from "vitest";
import { readLines, unwrap } from "../text";

describe("readLines", () => {
  it("splits a wargear line on ; and , and reads the counts", () => {
    expect(readLines("1 Chainsword; 1 Heavy Bolt Pistol, 2x Frag grenades.")).toEqual([
      { name: "Chainsword", count: 1 },
      { name: "Heavy Bolt Pistol", count: 1 },
      { name: "Frag grenades", count: 2 },
    ]);
  });
  it("one per line still works, bullets stripped", () => {
    expect(readLines("- Power Fist\n- Bolt pistol")).toEqual([{ name: "Power Fist" }, { name: "Bolt pistol" }]);
  });
});

describe("unwrap", () => {
  it("takes out a PDF's line breaks and puts one after each sentence", () => {
    const text = `The bearer and all Legionnaire models in his unit have the Feel No Pain special rule.
Furthermore, whenever an enemy unit fails a Fear, Pinning or Morale check within 12" of
the bearer, one randomly determined model in that unit is immediately removed as a
casualty with no saves of any kind allowed (though Look Out, Sir rolls can taken as
normal). For each model slain in this manner, the bearer's unit receives a +1 modifier to
their Feel No Pain rolls (to a maximum of 2+) until the end of the Player turn.`;
    expect(unwrap(text).split("\n")).toEqual([
      "The bearer and all Legionnaire models in his unit have the Feel No Pain special rule.",
      `Furthermore, whenever an enemy unit fails a Fear, Pinning or Morale check within 12" of the bearer, one randomly determined model in that unit is immediately removed as a casualty with no saves of any kind allowed (though Look Out, Sir rolls can taken as normal).`,
      "For each model slain in this manner, the bearer's unit receives a +1 modifier to their Feel No Pain rolls (to a maximum of 2+) until the end of the Player turn.",
    ]);
  });
  it("keeps abbreviations, decimals and a hyphenated word cut at the line end", () => {
    expect(unwrap("Roll a D6 (e.g. before moving). On a 3.5 or more, it is elec-\ntronically fired. Fig. 2 shows it.")).toBe(
      "Roll a D6 (e.g. before moving).\nOn a 3.5 or more, it is electronically fired.\nFig. 2 shows it.",
    );
  });
  it("blank lines stay paragraph breaks, bullets stay lines", () => {
    expect(unwrap("First rule\nends here.\n\n- one\n- two")).toBe("First rule ends here.\n\n- one\n- two");
  });
});

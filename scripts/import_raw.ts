import type { ParsedUnitText, Weapon, SpecialRule, Unit } from "./import_types";

export function parseUnitText(text: string): Unit {
    function lastItem<T>(array: Array<T>): T | undefined {
        return array[array.length - 1]
    }
    function replaceNewlineWithSpace(text: string) {
        // Replace `\n` preceded by `,` with just a space.
        return text.replace(/,\s*\n\s*/g, ', ');
    }
    const fixed = replaceNewlineWithSpace(text.replaceAll("\r", "\n")).split("\n").filter(o => o).join('\n')
    function findTextAroundTroopType(input: string) {
        // Define the regex pattern
        const pattern = /(.*?)(Troop Type:.*)$/s;

        // Attempt to match the pattern against the input
        const match = input.match(pattern);

        // Check if a match was found
        if (match) {
            return [match[1], match[2]];
        } else {
            // If no match was found, return null or an appropriate value
            if (input.includes('Points') && input.includes('WS')) {
                return [input, ""];
            } else {

                return ["", input];
            }
        }
    }

    const [profiles, content] = findTextAroundTroopType(fixed);
    const result = { Subheadings: {}, Name: "", Profiles: [], Points: null, ProfilesText: profiles } as Unit;
    const models = profiles.split('\n').filter(o => !o.includes('Points') && !o.includes('WS'))
    for (const model of models) {
        const splitted = model.replace(/\s+/g, " ").trim().split(' ')
        if (splitted.length < 10) {
            continue;
        }
        result.Profiles.push({
            Stats: {
                Points: splitted.pop()!,
                Ld: splitted.pop()!,
                A: splitted.pop()!,
                I: splitted.pop()!,
                W: splitted.pop()!,
                T: splitted.pop()!,
                S: splitted.pop()!,
                BS: splitted.pop()!,
                WS: splitted.pop()!,
                M: splitted.pop()!,
            },
            Name: splitted.join(' ')
        })
    }


    // State machine
    const lines = content.split('\n').filter(o => o)
    let current = "preSpecialRules";
    let startSection = content
    const weaponTables = [] as Array<{ rows: Weapon[] }>;
    const specialRuleDefinitions = [] as SpecialRule[];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        if (line.startsWith("Special Rules:")) {
            current = "specialRules"
            continue;
        } else if (current === "specialRules") {
            if (line.startsWith('•')) continue;
            startSection = lines.slice(0, i).join("\n")
            current = "afterSpecialRules"
        }
        if (current === "preSpecialRules") continue;

        if (line.includes(" R ") && line.includes(" S ") && line.includes(" AP ")) {
            current = "weaponsTable"
            weaponTables.push({ rows: [] as Weapon[] })
            continue;
        } else if (line.startsWith("Notes:")) {
            current = "notes"
        } else if (current === "afterSpecialRules") {
            current = "specialRuleDefinitions"
        }

        if (current === "weaponsTable") {
            if (line) {
                const last = lastItem(weaponTables)!;
                const [name, R, S, AP, specialRules] = line.replace(/\s{2,}/g, "  ").split("  ");
                last.rows.push({ Name: name, Stats: { R, S, AP, "Special Rules": specialRules, Notes: "" } })
            }
        }
        if (current === "notes") {
            const last = lastItem(weaponTables)!;
            const lastRow = lastItem(last.rows)!;
            if (lastRow.Stats.Notes) {
                lastRow.Stats.Notes += line
            }
        }
        if (current === "specialRuleDefinitions") {
            if (line.match(/^[A-Z][a-z]*(?:\s[A-Z][a-z]*)*$/)) {
                specialRuleDefinitions.push({ name: line, description: "" })
            } else {
                const lastRule = lastItem(specialRuleDefinitions)!
                lastRule.description = `${lastRule.description} ${line}`.trim()
            }
        }
    }

    const pattern = /(?:^|\n)([A-Za-z\s]+):\s*(.*?)(?=\n[A-Za-z\s]+:|$)/gs;
    const matches = [...startSection.matchAll(pattern)];
    matches.forEach(match => {
        const key = match[1].trim() + ":";
        const value = match[2].trim()
        result.Subheadings[key] = value;
    });

    // if (weaponTables.length) result.weaponTables = weaponTables
    if (specialRuleDefinitions.length) result["Special Rules"] = specialRuleDefinitions
    return result;
}

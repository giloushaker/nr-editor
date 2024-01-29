import type { BSIConstraint, BSICost, BSIEntryLink, BSIInfoLink, BSIModifier, BSIProfile, BSISelectionEntry, BSISelectionEntryGroup } from "~/assets/shared/battlescribe/bs_types";
import type { NoId, Profile, Unit, Weapon } from "./import_types";
import { hashFnv32a, parseSpecialRule } from "./import_helpers";
import { Base } from "~/assets/shared/battlescribe/bs_main";

export function toModelProfile(data: Profile, parentName?: string) {
  const { ruleName, param } = parseSpecialRule(data.Name) // Same format as a special rule   
  const stats = data.Stats;
  const result: NoId<BSIProfile> = {
    "characteristics": [
      { name: "M", typeId: "cd3b-a5a4-e185-5a9d", $text: stats.M ?? "-" },
      { name: "WS", typeId: "b007-7d58-4f14-1e01", $text: stats.WS ?? "-" },
      { name: "BS", typeId: "59f9-ccf5-1155-fb05", $text: stats.BS ?? "-" },
      { name: "S", typeId: "5b6b-1427-2a45-dd0c", $text: stats.S ?? "-" },
      { name: "T", typeId: "ab43-8b61-83e7-d090", $text: stats.T ?? "-" },
      { name: "W", typeId: "83ed-7b82-bf1f-e558", $text: stats.W ?? "-" },
      { name: "I", typeId: "73b1-abe5-72f8-41e2", $text: stats.I ?? "-" },
      { name: "A", typeId: "dddc-9fbd-b0fd-a480", $text: stats.A ?? "-" },
      { name: "Ld", typeId: "c435-6b14-f77e-3c72", $text: stats.Ld ?? "-" }
    ],
    name: ruleName!,
    hidden: false,
    typeId: "b070-143a-73f-2772",
    typeName: "Model"
  }
  if (parentName) {
    result.comment = `${parentName}/${ruleName!}`
  }
  return result;
}
export function toSpecialRule(name: string, desc: string) {
  const result: NoId<BSIProfile> = {
    name: name,
    hidden: false,
    typeId: "c1ac-c1c8-f9d5-9673",
    typeName: "Special Rule",
    characteristics: [
      { name: "Description", typeId: "9f84-4221-785a-db50", $text: desc }
    ]
  };
  return result;
}
export function toUnitProfile(unitName: string, unit: Unit) {
  if (!unit["Subheadings"]["Troop Type:"] || !unit["Subheadings"]['Unit Size:']) {
    console.log(`Couldn't make Unit profile for ${unitName} (missing data) in `, unit)
    return;
  }
  const result: BSIProfile = {
    characteristics: [
      {
        name: "Troop Type",
        typeId: "5d94-6b94-bd89-1944",
        $text: unit["Subheadings"]["Troop Type:"]
      },
      {
        name: "Unit Size",
        typeId: "80a1-bb6f-66e4-4a5b",
        $text: unit["Subheadings"]['Unit Size:']
      }
    ],
    name: unitName,
    typeId: "2878-9a1f-dd74-48e3",
    typeName: "Unit",
    hidden: false,
    id: hashFnv32a(`${unitName}/unit/profile`)
  }
  return result;

}
export function toWeaponProfile(name: string, weapon: Weapon) {
  return {
    name: name,
    hidden: false,
    id: hashFnv32a(`${name}/weapon/${weapon}/profile`),
    typeId: "a378-c633-912d-11ce",
    typeName: "Weapon",
    characteristics: [
      { "name": "R", "typeId": "2360-c777-5e07-ed58", "$text": weapon.Stats.R },
      { "name": "S", "typeId": "ac19-f99c-72e9-a1a7", "$text": weapon.Stats.S },
      { "name": "AP", "typeId": "9429-ffe7-2ce5-e9a5", "$text": weapon.Stats.AP },
      { "name": "Special Rules", "typeId": "5f83-3633-336b-93b4", "$text": weapon.Stats["Special Rules"] },
      { "name": "Notes", "typeId": "772a-a7ff-f6b3-df71", "$text": weapon.Stats.Notes }
    ]
  }
}


export function toInfoLink(unitName: string, entry: Base) {
  const specialRuleLink: BSIInfoLink = {
    name: entry.getName(),
    hidden: false,
    id: hashFnv32a(`${unitName}/${entry.typeName || "profile"}/${entry.getName()}`),
    type: "profile",
    targetId: entry.id,
    modifiers: [] as BSIModifier[]
  }
  return specialRuleLink;
}
export function toEquipment(itemName: string, hash: string, targetId?: string) {
  return {
    name: itemName,
    id: hashFnv32a(`${hash}/equipment/${itemName}`),
    hidden: false,
    type: "selectionEntry",
    targetId: targetId ?? itemName,
    constraints: [
      {
        type: "min", value: 1, scope: "parent", shared: false, field: "selections",
        id: hashFnv32a(`${hash}/equipment/${itemName}/min`)
      },
      {
        type: "max", value: 1, scope: "parent", shared: false, field: "selections",
        id: hashFnv32a(`${hash}/equipment/${itemName}/max`)
      },
    ]
  } as BSIEntryLink;
}
export function loreOfMagicConstraint() {
  return {
    "parentKey": "modifiers",
    "conditions": [
      {
        "type": "atLeast",
        "value": 1,
        "field": "selections",
        "scope": "parent",
        "childId": "8123-d36e-9442-13a1",
        "shared": true,
        "includeChildSelections": true
      }
    ],
    "type": "set",
    "value": 2,
    "field": "3e22-b735-4400-3d21"
  }
}
export function toGroup(name: string, hash: string): BSISelectionEntryGroup {
  return {
    name: name,
    hidden: false,
    id: hashFnv32a(`${hash}/${name}`),
    selectionEntries: [],
    entryLinks: [],
    constraints: [],
    modifiers: [],
  }
}
export function getGroup(entry: BSISelectionEntry, name: string, hash: string): BSISelectionEntryGroup {
  if (!entry.selectionEntryGroups) entry.selectionEntryGroups = []
  const found = entry.selectionEntryGroups.find(o => o.name === name)
  if (found) {
    return found
  }
  const created = toGroup(name, hash)
  entry.selectionEntryGroups.push(created);
  return created;
}

export function parseDetails(details: string) {
  const parsed = parseInt(details)
  return isNaN(parsed) ? 0 : parsed;
}
export function toCost(pts: number | string | undefined) {
  if (!pts) pts = 0;
  const parsed = typeof pts === "string" ? parseInt(pts) : pts
  return {
    name: "pts",
    typeId: "points",
    value: isNaN(parsed) ? 0 : parsed
  } as BSICost
}
export function toEntry(name: string | undefined, hash: string, cost?: string | number): BSISelectionEntry {
  if (!name) throw new Error("Cannot create entry with no name.")
  const result: BSISelectionEntry = {
    name: name,
    id: hashFnv32a(`${hash}/${name}`),
    costs: [],
    infoLinks: [],
    profiles: [],
    modifiers: [],
    entryLinks: [],
    type: "upgrade",
    import: true,
    hidden: false,
  }
  if (cost) {
    result.costs.push(toCost(cost))
  }
  return result;
}
export function toProfileLink(name: string | undefined, hash: string, targetId: string): BSIInfoLink {
  if (!name) throw new Error("Cannot create profile link with no name.")
  return {
    name: name,
    hidden: false,
    type: "profile",
    id: hashFnv32a(`${hash}/${name}`),
    targetId: targetId
  }
}
export function toEntryLink(name: string, hash: string, targetId?: string) {
  if (!name) throw new Error("Cannot create profile link with no name.")
  const link: BSIEntryLink = {
    import: true,
    name: name,
    hidden: false,
    id: hashFnv32a(`${hash}/${name}`),
    type: "selectionEntry",
    targetId: targetId ?? name,
    costs: [],
    modifiers: [],
    constraints: []
  }
  return link;
}
export function toGroupLink(name: string, hash: string, targetId?: string) {
  if (!name) throw new Error("Cannot create profile link with no name.")
  const link: BSIEntryLink = {
    import: true,
    name: name,
    hidden: false,
    id: hashFnv32a(`${hash}/${name}`),
    type: "selectionEntryGroup",
    targetId: targetId ?? name,
    costs: [],
    modifiers: [],
    constraints: [],
  }
  return link;
}
export function toMinConstraint(min: string | number, hash: string) {
  return {
    type: "min",
    value: min,
    field: "selections",
    scope: "parent",
    shared: false,
    id: hashFnv32a(`${hash}/min`)
  } as BSIConstraint;
}
export function toMaxConstraint(max: string | number, hash: string, scope = "parent") {
  return {
    type: "max",
    value: max,
    field: "selections",
    scope: scope,
    shared: false,
    id: hashFnv32a(`${hash}/max`)
  } as BSIConstraint;
}
export function toSpecialRuleLink(ruleName: string, hash: string, targetId?: string, param?: string | null) {
  const specialRuleLink: BSIInfoLink = {
    name: ruleName,
    hidden: false,
    id: hashFnv32a(`${hash}/rule/${ruleName}`),
    type: "profile",
    targetId: targetId ?? ruleName,
    modifiers: [] as BSIModifier[]
  }
  if (param) {
    specialRuleLink.modifiers!.push({ type: "append", value: `(${param})`, field: "name" })
  }
  return specialRuleLink;
}
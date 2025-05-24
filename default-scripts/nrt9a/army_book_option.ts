import { ArmyBookArmy, ArmyBookOption, ArmyBookUnit } from "./army_book_interfaces";
import { cost } from "../t9a/costs";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { hasOption } from "./constraints";

const sortIndex: Record<string, number> = {
  Models: 1,
  Leadership: 2,
  "Leadership Skills": 3,
  "Specialist Skills": 4,
  "Blood Powers": 5,
  Honour: 6,
  Type: 7,
  Command: 8,
  Mount: 9,
  Magic: 10,
  Level: 11,
  Path: 12,
  Equipment: 13,
  Weapons: 14,
  "Castellan Weapons": 15,
  Manifestations: 16,
  Options: 17,
};

function addConstraint(node: any, constraint: any) {
  constraint.id = `${node.id}-constraint-${node.constraints.length}`;
  node.constraints.push(constraint);
}

function addDictionnaryEntries(catalogue: Catalogue, opt: ArmyBookOption, res: Record<string, any>) {
  if (!opt.optionsDict) return;
  for (let dictRef of opt.optionsDict) {
    for (let sharedGroup of catalogue.sharedSelectionEntryGroups || []) {
      const split = sharedGroup.id.split(":");
      const refsList = split[1];
      if (refsList) {
        const refs = refsList.split("-");
        if (refs.includes(dictRef)) {
          if (!res.entryLinks) res.entryLinks = [];
          for (let item of sharedGroup.selectionEntries || []) {
            res.entryLinks.push({
              import: true,
              hidden: false,
              targetId: item.id,
              type: "selectionEntry",
            });
          }
        }
      }
    }
  }
}

export function convertArmyBookOption(
  catalogue: Catalogue,
  opt: ArmyBookOption,
  parentArmy: ArmyBookArmy,
  parentUnit?: ArmyBookUnit
): Record<string, any> {
  const res: any = {
    name: opt.name,
    id: opt.option_id,
    costs: cost(opt.cost),
    selectionEntries: [],
    selectionEntryGroups: [],
    constraints: [],
  };

  if (opt.type === "group" || opt.type == undefined) {
    res.name = opt.optionsLabel || opt.name;
  }

  if (opt.type == "check") {
    addConstraint(res, {
      type: "max",
      value: 1,
      field: "selections",
      scope: "parent",
      shared: true,
      includeChildSelections: false,
    });
  }

  if (opt.addToUnitSize) {
    res.name = "Models";
    res.sortIndex = 1;
  }

  if (opt.optionsLabel) {
    res.sortIndex = sortIndex[opt.optionsLabel];
  }

  let childGroup = res;

  // Cas d'une selection avec des options, il faut creer un child group
  if (opt.type == "check" || opt.type == "numeric") {
    if (opt.options?.length || opt.optionsDict?.length) {
      childGroup = {
        name: opt.optionsLabel || opt.name,
        selectionEntries: [],
        selectionEntryGroups: [],
        constraints: [],
      };
      res.selectionEntryGroups.push(childGroup);
    }
  }

  if (opt.minSize) {
    addConstraint(childGroup, {
      type: "min",
      value: opt.minSize,
      field: "selections",
      scope: "parent",
      shared: true,
      includeChildSelections: false,
    });
  }

  if (opt.maxSize) {
    addConstraint(childGroup, {
      type: "max",
      value: opt.maxSize,
      field: "selections",
      scope: "parent",
      shared: true,
      includeChildSelections: false,
    });
  }

  addDictionnaryEntries(catalogue, opt, childGroup);

  if (res.name === "Number" && parentUnit) res.name = parentUnit.name;

  hasOption(opt, parentArmy, res);

  for (let child of opt.options || []) {
    const converted = convertArmyBookOption(catalogue, child, parentArmy, parentUnit);
    if (child.type == undefined || child.type === "group") {
      childGroup.selectionEntryGroups.push(converted);
    } else {
      childGroup.selectionEntries.push(converted);
    }
  }

  return res;
}

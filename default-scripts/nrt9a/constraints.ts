import { BSIConditionGroup, BSIConstraint, BSIModifier } from "~/assets/shared/battlescribe/bs_types";
import { ArmyBookOption } from "./army_book_interfaces";
import T9AImporter from "./t9a_importer";
import { toTitleCaseWords } from "./util";
import { convertRef } from "./refs";
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { specialCost, specialCostType } from "../t9a/costs";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

function insertIdConditions(id: string, scope: string): BSIConditionGroup {
  const res: BSIConditionGroup = {
    type: "or",
    conditions: [],
    conditionGroups: [],
  };

  if (res.conditions) {
    res.conditions.push({
      type: "instanceOf",
      value: 1,
      field: "selections",
      scope: scope,
      childId: id,
      shared: true,
      includeChildSelections: true,
    });

    res.conditions.push({
      type: "atLeast",
      value: 1,
      field: "selections",
      scope: scope,
      childId: id,
      shared: true,
      includeChildSelections: true,
    });
  }
  return res;
}

export function addConstraint(node: any, constraint: any) {
  constraint.id = `${node.id}-constraint-${node.constraints.length}`;
  node.constraints.push(constraint);
}

export async function hasNotOption(
  field: "hasNotOption" | "armyHasNotOption",
  importer: T9AImporter,
  node: ArmyBookOption,
  res: Record<string, any>
) {
  let foundCondition = false;
  if (node[field] && node[field].length) {
    const modifier: BSIModifier = {
      type: "set",
      value: true,
      field: "hidden",
      localConditionGroups: [],
      conditionGroups: [
        {
          type: "or",
          conditions: [],
          conditionGroups: [],
        },
      ],
    };

    res.hidden = false;
    if (!res.modifiers) {
      res.modifiers = [];
    }

    for (let opt of node[field]) {
      let hasOptionBlock = opt;
      if (typeof hasOptionBlock === "string") {
        hasOptionBlock = {
          refs: [hasOptionBlock],
          amount: 1,
        };
      }

      const orElement: BSIConditionGroup = {
        type: "or",
        conditions: [],
        conditionGroups: [],
      };

      for (let ref of hasOptionBlock.refs) {
        // if the node has itself as a ref, we insert a simple constraint, not a modifier
        if (node.refs) {
          if (node.refs.map((elt) => convertRef(elt)).find((r) => r.ref == ref)) {
            if (!res.constraints) res.constraints = [];
            const constraint: BSIConstraint = {
              id: generateBattlescribeId(),
              type: "max",
              scope: field == "armyHasNotOption" ? "roster" : "unit",
              field: "selections",
              value: hasOptionBlock.amount,
            };
            res.constraints.push(constraint);
            continue;
          }
        }

        const refs = importer.refCatalogue[ref];
        let id = refs?.category_id || refs?.option_id;

        const cat = importer.categoryCatalogue.categoryEntries?.find((elt) => elt.comment === ref);
        if (cat) {
          id = cat.id;
        }

        if (id) {
          const cond = insertIdConditions(id, field === "hasNotOption" ? "unit" : "roster");
          orElement.conditionGroups?.push(cond);
          foundCondition = true;
        }
      }

      if (modifier.conditionGroups && modifier.conditionGroups[0].conditionGroups) {
        modifier.conditionGroups[0].conditionGroups.push(orElement);
      }
    }

    if (foundCondition) {
      res.modifiers.push(modifier);
    }
  }
}

export async function hasOption(
  field: "hasOption" | "armyHasOption",
  importer: T9AImporter,
  node: ArmyBookOption,
  res: Record<string, any>
) {
  if (node[field] && node[field].length) {
    const modifier: BSIModifier = {
      type: "set",
      value: false,
      field: "hidden",
      localConditionGroups: [],
      conditionGroups: [
        {
          type: "and",
          conditions: [],
          conditionGroups: [],
        },
      ],
    };

    res.hidden = true;
    if (!res.modifiers) {
      res.modifiers = [];
    }
    res.modifiers.push(modifier);

    for (let opt of node[field]) {
      let hasOptionBlock = opt;
      if (typeof hasOptionBlock === "string") {
        hasOptionBlock = {
          refs: [hasOptionBlock],
          amount: 1,
        };
      }

      const orElement: BSIConditionGroup = {
        type: "or",
        conditions: [],
        conditionGroups: [],
      };

      for (let ref of hasOptionBlock.refs) {
        const refs = importer.refCatalogue[ref];
        let id = refs?.category_id || refs?.option_id;

        const cat = importer.categoryCatalogue.categoryEntries?.find((elt) => elt.comment === ref);
        if (cat) {
          id = cat.id;
        }

        //  if (refs.category_id == null) {
        if (id) {
          const cond = insertIdConditions(id, field === "hasOption" ? "unit" : "roster");
          orElement.conditionGroups?.push(cond);
        }
      }

      if (modifier.conditionGroups && modifier.conditionGroups[0].conditionGroups) {
        modifier.conditionGroups[0].conditionGroups.push(orElement);
      }
    }
  }
}

export async function initConstraintCategories(importer: T9AImporter) {
  const categoryNames: Record<string, string> = {
    weaponEnchantUni: "Weapon Enchant",
    army_unique: "One of a Kind",
  };

  const catalogue = importer.catalogues.find((elt) => elt.name === "Categories");
  if (!catalogue) return;

  for (let ref in importer.refCatalogue) {
    const item = importer.refCatalogue[ref];
    if (item.amount > 1) {
      const existing = catalogue.categoryEntries || [];
      let found = existing.find((cat) => cat.comment === ref);
      if (found == null) {
        found = await $store.add(
          {
            name: categoryNames[ref] || toTitleCaseWords(ref),
            comment: ref,
          },
          "categoryEntries",
          catalogue as any
        );
        item.category_id = found?.id;
      }
    }
  }
}

export function leafMaxCost(importer: T9AImporter, node: ArmyBookOption, res: Record<string, any>) {
  // set leaf max cost on the node
  const leafMaxCost = node.leafMaxCost;
  if (leafMaxCost) {
    const constraint: BSIConstraint = {
      id: generateBattlescribeId(),
      field: specialCostType(),
      value: leafMaxCost,
      scope: "self",
      includeChildSelections: true,
      type: "max",
    };
    res.constraints.push(constraint);
    res.comment = "leafMaxCost";
  }

  if (node.countAsLeaf != null) {
    res.comment = `leaf:${node.countAsLeaf}`;
  }
}

function isLeaf(node: EditorBase) {
  const com = node.comment;

  if (com?.startsWith("leaf:")) {
    const leaf = com.split(":")[1];
    if (leaf === "true") return true;
    if (leaf === "false") return false;
  }

  let parent = node.parent;
  while (parent) {
    if (parent.comment === "leafMaxCost") return true;
    parent = parent.parent;
  }

  return false;
}

export async function setSpecialEquipment(node: EditorBase) {
  // set special equipment cost
  if (isLeaf(node)) {
    const cost = node.target?.costs?.find((elt) => elt.name === "pts");

    if (cost) {
      const newCost = specialCost(cost.value);
      await $store.add(newCost, "costs", node);
    }
  }
}

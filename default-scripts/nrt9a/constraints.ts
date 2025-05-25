import { BSICondition, BSIConditionGroup, BSIModifier } from "~/assets/shared/battlescribe/bs_types";
import { ArmyBookOption } from "./army_book_interfaces";
import T9AImporter from "./t9a_importer";
import { toTitleCaseWords } from "./util";

function insertIdConditions(found: string[], scope: string): BSIConditionGroup {
  const res: BSIConditionGroup = {
    type: "or",
    conditions: [],
    conditionGroups: [],
  };

  for (let id of found) {
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
  }
  return res;
}

export function addConstraint(node: any, constraint: any) {
  constraint.id = `${node.id}-constraint-${node.constraints.length}`;
  node.constraints.push(constraint);
}

export async function hasOption(
  field: "hasOption" | "armyHasOption",
  importer: T9AImporter,
  node: ArmyBookOption,
  scope: ArmyBookOption,
  res: Record<string, any>
) {
  if (node[field]) {
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
        if (refs) {
          if (refs.category_id == null) {
            const cond = insertIdConditions([refs.option_id], scope.option_id);
            orElement.conditionGroups?.push(cond);
          } else {
            // Create a constraint on the category
            const cond: BSICondition = {
              type: "atLeast",
              value: refs.amount,
              field: "selections",
              scope: field === "hasOption" ? "unit" : "roster",
              childId: refs.category_id,
              shared: true,
              includeChildSelections: true,
            };
            const categoryCatalogue = importer.catalogues.find((elt) => elt.name === "Categories");
            if (categoryCatalogue) {
              const category = categoryCatalogue.categoryEntries?.find((elt) => elt.comment === ref);
              const existing = category?.constraints || [];

              if (existing.length) {
                if (existing[0].value != cond.value || existing[0].scope != cond.scope) {
                  console.error(
                    `A condition already exists for category ${refs.category_id} with a different amount or scope`
                  );
                }
              } else {
                await $store.add(cond, "constraints", category as any);
              }
            }
          }
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

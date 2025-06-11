import { BSIConditionGroup } from "~/assets/shared/battlescribe/bs_types";
import { ArmyBookCondition } from "./army_book_interfaces";
import T9AImporter from "./t9a_importer";

export function insertIdConditions(id: string, scope: string, amt: number): BSIConditionGroup {
  const res: BSIConditionGroup = {
    type: "or",
    conditions: [],
    conditionGroups: [],
  };

  if (res.conditions) {
    res.conditions.push({
      type: "instanceOf",
      value: amt,
      field: "selections",
      scope: scope,
      childId: id,
      shared: true,
      includeChildSelections: true,
    });

    res.conditions.push({
      type: "atLeast",
      value: amt,
      field: "selections",
      scope: scope,
      childId: id,
      shared: true,
      includeChildSelections: true,
    });
  }
  return res;
}

export function getConditionFromHasOption(
  importer: T9AImporter,
  hasOptionBlock: ArmyBookCondition,
  field: "hasOption" | "armyHasOption"
) {
  const res: BSIConditionGroup[] = [];

  for (let ref of hasOptionBlock.refs) {
    const refs = importer.refCatalogue[ref];
    let id = refs?.category_id || refs?.option_id;

    const cat = importer.categoryCatalogue.categoryEntries?.find((elt) => elt.comment === ref);
    if (cat) {
      id = cat.id;
    }

    if (id) {
      const cond = insertIdConditions(id, field === "hasOption" ? "unit" : "roster", 1);
      res.push(cond);
    }
  }

  return res;
}

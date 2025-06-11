import { BSIModifier } from "~/assets/shared/battlescribe/bs_types";
import { ArmyBookOption, ArmyBookOverride } from "./army_book_interfaces";
import T9AImporter from "./t9a_importer";
import { getConditionFromHasOption } from "./conditions";

export function override(importer: T9AImporter, node: ArmyBookOption, res: Record<string, any>) {
  if (node.override) {
    for (let overrideNode of node.override) {
      overrideFromComment(importer, overrideNode, res, "leafMaxCost");
      overrideFromComment(importer, overrideNode, res, "minSize");
      overrideFromComment(importer, overrideNode, res, "maxSize");
    }
  }
}

function insertConditions(importer: T9AImporter, modifier: BSIModifier, overrideNode: ArmyBookOverride) {
  for (let elt of overrideNode.hasOption || []) {
    modifier.conditionGroups?.push(...getConditionFromHasOption(importer, elt, "hasOption"));
  }

  for (let elt of overrideNode.armyHasOption || []) {
    modifier.conditionGroups?.push(...getConditionFromHasOption(importer, elt, "armyHasOption"));
  }
}

type CommentModifiable = "leafMaxCost" | "maxSize" | "minSize";
export function overrideFromComment(
  importer: T9AImporter,
  overrideNode: ArmyBookOverride,
  res: Record<string, any>,
  comment: CommentModifiable
) {
  if (overrideNode.options[comment]) {
    // Find the leaf max cost constraint in the res
    const constraint = res["constraints"]?.find((elt: any) => elt.comment === comment);
    if (constraint && overrideNode.options[comment]) {
      // Create a modifier
      const modifier: BSIModifier = {
        type: "set",
        field: constraint.id,
        value: overrideNode.options[comment],
        conditionGroups: [],
      };

      insertConditions(importer, modifier, overrideNode);

      if (!res.modifiers) res.modifiers = [];
      res.modifiers.push(modifier);
    }
  }
}

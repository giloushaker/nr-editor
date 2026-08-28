import { BSIModifier } from "~/assets/shared/battlescribe/bs_types";
import { ArmyBookOption, ArmyBookOverride } from "./army_book_interfaces";
import T9AImporter from "./t9a_importer";
import { getConditionFromHasOption } from "./conditions";

export function override(importer: T9AImporter, node: ArmyBookOption, res: Record<string, any>) {
  if (node.override) {
    for (const overrideNode of node.override) {
      overrideFromComment(importer, overrideNode, res, "leafMaxCost");
      overrideFromComment(importer, overrideNode, res, "minSize");
      overrideFromComment(importer, overrideNode, res, "maxSize");
    }
  }
}

function insertConditions(importer: T9AImporter, modifier: BSIModifier, overrideNode: ArmyBookOverride) {
  for (const elt of overrideNode.hasOption || []) {
    modifier.conditionGroups?.push(...getConditionFromHasOption(importer, elt, "hasOption"));
  }

  for (const elt of overrideNode.armyHasOption || []) {
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
  // Hoisted: the index access is re-read on each use, so the truthiness checks below do not
  // narrow away the `undefined` that BSIModifier.value rejects.
  const overrideValue = overrideNode.options[comment];
  if (overrideValue) {
    // Find the leaf max cost constraint in the res
    const constraint = res["constraints"]?.find((elt: any) => elt.comment === comment);
    if (constraint) {
      // Create a modifier
      const modifier: BSIModifier = {
        type: "set",
        field: constraint.id,
        value: overrideValue,
        conditionGroups: [],
      };

      insertConditions(importer, modifier, overrideNode);

      if (!res.modifiers) res.modifiers = [];
      res.modifiers.push(modifier);
    }
  }
}

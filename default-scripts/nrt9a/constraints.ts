import { BSIConditionGroup, BSIModifier } from "~/assets/shared/battlescribe/bs_types";
import { ArmyBookOption } from "./army_book_interfaces";

function findRefIds(node: ArmyBookOption, ref: string, res: string[]) {
  const refs = (node.refs || []).map((elt) => {
    if (typeof elt === "string") return { ref: elt, amount: 1 };
    return elt;
  });
  for (let elt of refs) {
    if (elt.ref === ref) {
      res.push(node.option_id);
    }
  }
  for (let child of node.options || []) {
    findRefIds(child, ref, res);
  }
}

function getRefCondition(scope: ArmyBookOption, ref: string, amount: number): BSIConditionGroup {
  const found: string[] = [];
  findRefIds(scope, ref, found);
  const res: BSIConditionGroup = {
    type: "or",
    conditions: [],
    conditionGroups: [],
  };

  for (let id of found) {
    if (res.conditions) {
      res.conditions.push({
        type: "instanceOf",
        value: amount,
        field: "selections",
        scope: "unit",
        childId: id,
        shared: true,
        includeChildSelections: true,
      });

      res.conditions.push({
        type: "atLeast",
        value: amount,
        field: "selections",
        scope: "unit",
        childId: id,
        shared: true,
        includeChildSelections: true,
      });
    }
  }
  return res;
}

export function hasOption(node: ArmyBookOption, unit: ArmyBookOption, res: Record<string, any>) {
  if (node.hasOption) {
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

    for (let opt of node.hasOption) {
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
        const cond = getRefCondition(unit, ref, hasOptionBlock.amount);
        orElement.conditionGroups?.push(cond);
      }

      if (modifier.conditionGroups && modifier.conditionGroups[0].conditionGroups) {
        modifier.conditionGroups[0].conditionGroups.push(orElement);
      }
    }
  }
}

/*
{
  "parentKey": "modifiers",
  "type": "set",
  "value": false,
  "field": "hidden",
  "localConditionGroups": [],
  "conditionGroups": [
    {
      "type": "or",
      "conditions": [],
      "conditionGroups": [
        {
          "type": "and",
          "conditions": [
            {
              "type": "instanceOf",
              "value": 1,
              "field": "selections",
              "scope": "unit",
              "childId": "xwsub4gu99cmky6ya031io",
              "shared": true,
              "includeChildSelections": true
            },
            {
              "type": "atLeast",
              "value": 1,
              "field": "selections",
              "scope": "unit",
              "childId": "xwsub4gu99cmky6ya031io",
              "shared": true,
              "includeChildSelections": true
            }
          ]
        }
      ]
    }
  ]
}
  */

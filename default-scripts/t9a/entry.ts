import { ArmyListEntry, Loc } from "./types";
import categories from "./categories";
import { cost } from "./costs";
import { BSIConstraint } from "~/assets/shared/battlescribe/bs_types";
/*
  - name: string;

  - categories?: string[];
  - cost?: number;
  - unitSize?: number;
  - costpermodel?: number;
  - commandgroup?: CommandGroup;

  maxunitsize?: number;
  inherits?: string;
  rarity?: string;
  height?: number;
  baseSize?: { width: number; depth: number };
  profile?: UnitProfile;
  options?: OptionEntry[];
  mounts?: Mounts;
  paths?: string[];
  wizardconclave?: WizardConclave;
  modelRules?: { name: string }[];
  optionalModelRules?: { name: string }[];
  specificOptions?: OptionEntry[];
*/
export function toEntry(json: ArmyListEntry, loc: Record<string, string>): Record<string, any> {
  const minCost = (json.cost || 0) - (json.costpermodel || 0) * (json.unitSize || 1);
  const res: any = {
    name: loc[json.name],
    costs: [cost(minCost)],

    categoryLinks: (json.categories || []).map((cat) => categories[cat]),
    selectionEntries: [],
    selectionEntryGroups: [],
    type: "unit",
  };

  if (res.categoryLinks.length) {
    res.categoryLinks[0].primary = true;
  }

  const modelEntry = {
    type: "model",
    costs: json.costpermodel ? [cost(json.costpermodel)] : [],
    constraints: [] as Omit<BSIConstraint, "id">[],
    name: loc[json.name],
    hidden: false,
    sortIndex: 1,
  };

  modelEntry.constraints.push({
    type: "min",
    value: json.unitSize || 1,
    field: "selections",
    scope: "parent",
    shared: true,
    includeChildSelections: true,
  });

  if (json.maxunitsize) {
    modelEntry.constraints.push({
      type: "max",
      value: json.maxunitsize,
      field: "selections",
      scope: "parent",
      shared: true,
      includeChildSelections: true,
    });
  }

  res.selectionEntries.push(modelEntry);

  // Command Group
  if (json.commandgroup) {
    const commandEntryGroup = {
      parentKey: "selectionEntryGroups",
      name: "Command Group",
      hidden: false,
      selectionEntries: [] as any[],
    };
    res.selectionEntryGroups.push(commandEntryGroup);

    for (let param of json.commandgroup.parameters.list || []) {
      commandEntryGroup.selectionEntries.push({
        constraints: [
          {
            field: "selections",
            scope: "parent",
            value: 1,
            percentValue: false,
            shared: true,
            includeChildSelections: false,
            includeChildForces: false,
            type: "max",
          },
        ],
        costs: [cost(param.cost || 0)],
        name: loc[param.name || ""],
        hidden: false,
        collective: false,
        import: true,
        type: "upgrade",
      });
    }
  }

  return res;
}

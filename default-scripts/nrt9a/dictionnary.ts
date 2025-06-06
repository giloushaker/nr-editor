import { BSICost } from "~/assets/shared/battlescribe/bs_types";
import { ArmyBookOption } from "./army_book_interfaces";
import { Group } from "~/assets/shared/battlescribe/bs_main";
import { cost, specialCost } from "../t9a/costs";

export function addDictionnaryEntries(groups: Group[], opt: ArmyBookOption, res: Record<string, any>) {
  if (!opt.optionsDict) return;

  for (let dictRef of opt.optionsDict) {
    for (let sharedGroup of groups || []) {
      const split = sharedGroup.comment?.split(":");
      if (split && split.length >= 2 && split[0] == "dict") {
        const refsList = split[1];
        if (refsList) {
          const refs = refsList.split("-");
          if (refs.includes(dictRef)) {
            if (!res.entryLinks) res.entryLinks = [];
            for (let item of sharedGroup.selectionEntries || []) {
              if (item.comment !== "shared item") {
                res.entryLinks.push({
                  name: item.name,
                  import: true,
                  hidden: false,
                  targetId: item.id,
                  type: "selectionEntry",
                });
              }
            }

            for (let item of sharedGroup.entryLinks || []) {
              const link = {
                name: item.name,
                import: true,
                hidden: false,
                targetId: item.targetId,
                type: "selectionEntry",
                costs: item.costs?.map((elt) => {
                  const res: BSICost = {
                    typeId: elt.typeId,
                    name: elt.name,
                    value: elt.value,
                  };
                  return res;
                }),
              };
              // Add Special Equipment Cost
              if (link.costs?.length == 1) {
                link.costs.push(specialCost(link.costs[0].value));
              }
              res.entryLinks.push(link);
            }
          }
        }
      }
    }
  }
}

import { ArmyBookOption } from "./army_book_interfaces";
import { Group } from "~/assets/shared/battlescribe/bs_main";

export function addDictionnaryEntries(groups: Group[], opt: ArmyBookOption, res: Record<string, any>) {
  if (!opt.optionsDict) return;

  for (let dictRef of opt.optionsDict) {
    for (let sharedGroup of groups || []) {
      const split = sharedGroup.id.split(":");
      const refsList = split[1];
      if (refsList) {
        const refs = refsList.split("-");
        if (refs.includes(dictRef)) {
          if (!res.entryLinks) res.entryLinks = [];

          const gr = [sharedGroup.selectionEntries || [], sharedGroup.entryLinks || []];
          for (let shgr of gr) {
            for (let item of shgr) {
              res.entryLinks.push({
                import: true,
                hidden: false,
                targetId: item.targetId || item.id,
                type: "selectionEntry",
                costs: item.costs,
              });
            }
          }
        }
      }
    }
  }
}

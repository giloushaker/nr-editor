import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { ArmyListEntry, T9aJson } from "./types";
import { toEntry } from "./entry";

export default {
  name: "Imports a T9A Json file",
  arguments: [
    {
      name: "catalogues",
      type: "catalogue[]",
    },
    {
      name: "json",
      type: "string",
      optional: true,
      description: "Json file for t9a",
    },
  ],
  run(catalogues: Catalogue[], json?: string) {
    catalogues.map((elt) => elt.processForEditor());

    const parsed = JSON.parse((json || "").replace(/ /g, "")) as T9aJson;
    parsed.loc.en["musician"] = "Musician";
    parsed.loc.en["standardbearer"] = "Standard Bearer";

    // Add units from the army list
    for (let entry of parsed.armyList) {
      if (!entry.inherits) {
        const selectionEntry = toEntry(entry, parsed.loc.en);
        $store.add(selectionEntry, "sharedSelectionEntries", catalogues[0] as any);
      }
    }

    return "Import done";
  },
};

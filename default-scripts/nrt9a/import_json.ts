import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { ArmyBookBook, ArmyBookOption } from "./army_book_interfaces";
import { convertArmyBookUnit } from "./army_book_unit";
import { convertArmyBookOption } from "./army_book_option";

export default {
  name: "Imports a T9A Json file",
  arguments: [
    {
      name: "catalogues",
      type: "catalogue[]",
    },
    {
      name: "json",
      type: "file",
      optional: true,
      description: "Json file for t9a",
    },
  ],
  async run(catalogues: Catalogue[], json?: string) {
    catalogues.map((elt) => elt.processForEditor());

    const parsed = JSON.parse((json || "").replace(/ /g, "")) as ArmyBookBook;

    const catalogue = catalogues[0];

    const army = parsed.army[0];

    // Add dictionnary
    if (parsed.dictionnary) {
      for (let elt of parsed.dictionnary) {
        const opt: ArmyBookOption = {
          ...elt,
          option_id: `dict:${elt.refs.join("-")}`,
          name: elt.refs.join(","),
          optionsLabel: elt.refs.join(","),
        };
        const converted = convertArmyBookOption(catalogue, opt, army);

        await $store.add(converted, "sharedSelectionEntryGroups", catalogue as any);
      }
    }

    // Add Units
    for (let cat of parsed.army[0].options) {
      for (let unit of cat.options) {
        const converted = convertArmyBookUnit(catalogue, unit, army);
        if (cat.invisible) {
          await $store.add(converted, "sharedSelectionEntries", catalogues[0] as any);
        } else {
          await $store.add(converted, "selectionEntries", catalogues[0] as any);
        }
      }
    }

    return "Import done";
  },
};

import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { insertUnitRarity } from "./rarity";

export default {
  name: "Set Rarity Constraints for T9A",
  arguments: [
    {
      name: "catalogues",
      type: "catalogue[]",
    },
  ],

  async run(catalogues: Catalogue[], book: string, clean: boolean) {
    catalogues.map((elt) => elt.processForEditor());
    for (let cat of catalogues) {
      insertUnitRarity(cat);
    }
  },
};

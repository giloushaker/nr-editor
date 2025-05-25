import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import T9AImporter from "./t9a_importer";

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
      description: "Json Book file for t9a",
    },
  ],

  async run(catalogues: Catalogue[], book: string, special: string) {
    catalogues.map((elt) => elt.processForEditor());
    const importer = new T9AImporter(catalogues, book);
    importer.import();
    return "Import done";
  },
};

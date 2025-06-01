import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import T9AImporter from "./t9a_importer";
import ProfileImporter from "./profile_import";
import RulesImporter from "./rule_importer";
import { cleanup } from "./util";

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
    {
      name: "cleanup",
      type: "boolean",
      description: "Cleanup Only",
    },
  ],

  async run(catalogues: Catalogue[], book: string, clean: boolean) {
    catalogues.map((elt) => elt.processForEditor());

    if (clean) {
      cleanup(catalogues[0], true);
      for (let i = 1; i < catalogues.length; i++) {
        cleanup(catalogues[i]);
      }
      return;
    }

    const json = JSON.parse((book || "").replace(/ /g, ""));
    if (json.name != "Unit Stats" && json.name != "Rule Definitions") {
      const importer = new T9AImporter(catalogues, json);

      importer.import();
    }

    if (json.name === "Unit Stats") {
      const statsImporter = new ProfileImporter(catalogues, json);
      statsImporter.import();
    }

    if (json.name === "Rule Definitions") {
      const statsImporter = new RulesImporter(catalogues, json);
      statsImporter.import();
    }
    return "Import done";
  },
};

import { BSCatalogueManager } from "~/assets/shared/battlescribe/bs_system";
import {
  BSIDataSystem,
  BSIDataCatalogue,
  BSICatalogueLink,
  BSIData,
} from "~/assets/shared/battlescribe/bs_types";
import { BooksDate } from "~/assets/shared/battlescribe/bs_versioning";
import {
  BookFetchFunction,
  BsGameSystem,
} from "~/assets/shared/systems/bs_game_system";
import { GameSystemRow } from "~/assets/shared/types/db_types";
import { db } from "../dexie";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export class GameSystem extends BsGameSystem {
  constructor(
    systemRow: GameSystemRow,
    lang: string,
    fetchStrategy: BookFetchFunction
  ) {
    super(systemRow, lang, fetchStrategy);
  }
}

export class GameSystemFiles extends BSCatalogueManager {
  gameSystem: BSIDataSystem | null = null;
  catalogueFiles: Record<string, BSIDataCatalogue> = {};
  async getData(
    catalogueLink: BSICatalogueLink,
    booksDate?: BooksDate
  ): Promise<BSIData> {
    if (catalogueLink.targetId == this.gameSystem?.gameSystem.id) {
      return this.gameSystem;
    }
    if (catalogueLink.targetId in this.catalogueFiles) {
      return this.catalogueFiles[catalogueLink.targetId];
    }

    const catalogue = await db.catalogues.get({
      "content.catalogue.id": catalogueLink.targetId,
    });
    if (catalogue) {
      return catalogue.content;
    }

    const system = await db.systems.get(catalogueLink.targetId);
    if (system) {
      return system.content;
    }

    const errorPart = catalogueLink.name
      ? `name ${catalogueLink.name}`
      : `id ${catalogueLink.targetId}`;
    throw Error(
      `Couldn't import catalogue with ${errorPart}, perhaps it wasnt uploaded?`
    );
  }
  setSystem(system: BSIDataSystem) {
    this.gameSystem = system;
  }
  setCatalogue(catalogue: BSIDataCatalogue) {
    const catalogueId = catalogue.catalogue.id;
    this.catalogueFiles[catalogueId] = catalogue;
  }
  removeCatalogue(catalogue: BSIDataCatalogue) {
    for (const [key, value] of Object.entries(this.catalogueFiles)) {
      if (value.catalogue.id === catalogue.catalogue.id) {
        delete this.catalogueFiles[key];
      }
    }
  }
}

export function saveCatalogue(data: Catalogue, raw: BSIData) {
  const badKeys = new Set([
    "loaded",
    "loaded_wiki",
    "loaded_editor",
    "units",
    "categories",
    "forces",
    "childs",
    "roster_constraints",
    "extra_constraints",
    "costIndex",
    "imports",
    "index",
    "catalogue",
    "gameSystem",
    "main_catalogue",
    "collective_recursive",
    "limited_to_one",
    "associations",
    "associationConstraints",
    "book",
    "short",
    "version",
    "nrversion",
    "lastUpdated",
    "costIndex",
    "target",
    "parent",
    "links",
  ]);
  const root: any = {
    ...raw,
    catalogue: undefined,
    gameSystem: undefined,
  };
  const copy = { ...data }; // ensure there is no recursivity by making sure only this copy is put in the json
  if (data.isGameSystem()) {
    root.gameSystem = copy;
  } else if (data.isCatalogue()) {
    root.catalogue = copy;
  }
  const stringed = JSON.stringify(root, (k, v) => {
    if (v === copy || !badKeys.has(k)) return v;
    return undefined;
  });
  if (root.catalogue) {
    db.catalogues.put({
      content: JSON.parse(stringed),
      id: `${root.catalogue.gameSystemId}-${root.catalogue.id}`,
    });
  }
  if (root.gameSystem) {
    db.systems.put({
      content: JSON.parse(stringed),
      id: root.gameSystem.id,
    });
  }
}

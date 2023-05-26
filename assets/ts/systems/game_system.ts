import { BSCatalogueManager, loadData } from "~/assets/shared/battlescribe/bs_system";
import { BSIDataSystem, BSIDataCatalogue, BSICatalogueLink, BSIData } from "~/assets/shared/battlescribe/bs_types";
import { BooksDate } from "~/assets/shared/battlescribe/bs_versioning";
import { BookFetchFunction, BsGameSystem } from "~/assets/shared/systems/bs_game_system";
import { GameSystemRow } from "~/assets/shared/types/db_types";
import { db } from "../dexie";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { rootToJson } from "~/assets/shared/battlescribe/bs_main";

export class GameSystem extends BsGameSystem {
  constructor(systemRow: GameSystemRow, lang: string, fetchStrategy: BookFetchFunction) {
    super(systemRow, lang, fetchStrategy);
  }
}

export class GameSystemFiles extends BSCatalogueManager {
  gameSystem: BSIDataSystem | null = null;
  catalogueFiles: Record<string, BSIDataCatalogue> = {};
  allLoaded?: boolean;
  async getData(catalogueLink: BSICatalogueLink, booksDate?: BooksDate): Promise<BSIData> {
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

    const errorPart = catalogueLink.name ? `name ${catalogueLink.name}` : `id ${catalogueLink.targetId}`;
    throw Error(`Couldn't import catalogue with ${errorPart}, perhaps it wasnt uploaded?`);
  }
  async loadData(data: BSIData, booksDate?: BooksDate): Promise<Catalogue> {
    const loaded = await loadData(this, data, booksDate);
    loaded.processForEditor();
    return loaded;
  }
  async loadAll() {
    if (this.gameSystem) {
      const loadedSys = await this.loadCatalogue({ targetId: this.gameSystem.gameSystem.id });
      loadedSys.processForEditor();
      for (const catalogue of Object.values(this.catalogueFiles)) {
        const loaded = await this.loadCatalogue({ targetId: catalogue.catalogue.id });
        loaded.processForEditor();
      }
    }
    this.allLoaded = true;
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

export function saveCatalogue(data: Catalogue, raw: BSIData | Catalogue) {
  const stringed = rootToJson(data, raw);
  if (data.isGameSystem()) {
    db.systems.put({
      content: JSON.parse(stringed),
      id: data.getId(),
    });
  } else {
    db.catalogues.put({
      content: JSON.parse(stringed),
      id: `${data.gameSystem.getId()}-${data.getId()}`,
    });
  }
}

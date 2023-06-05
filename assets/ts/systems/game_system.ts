import { BSCatalogueManager, getDataObject, loadData } from "~/assets/shared/battlescribe/bs_system";
import {
  BSIDataSystem,
  BSIDataCatalogue,
  BSICatalogueLink,
  BSIData,
  BSICatalogue,
  BSIGameSystem,
} from "~/assets/shared/battlescribe/bs_types";
import { BooksDate } from "~/assets/shared/battlescribe/bs_versioning";
import { BookFetchFunction, BsGameSystem } from "~/assets/shared/systems/bs_game_system";
import { GameSystemRow } from "~/assets/shared/types/db_types";
import { db } from "../dexie";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { rootToJson } from "~/assets/shared/battlescribe/bs_main";
import { convertToXml, getExtension, isZipExtension } from "~/assets/shared/battlescribe/bs_convert";
import { zip } from "~/assets/shared/util";
import { filename, writeFile } from "~/electron/node_helpers";
import JSZip, { OutputType } from "jszip";

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
    const loaded = await loadData(this, data, booksDate, { deleteBadLinks: false });
    loaded.processForEditor();
    return loaded;
  }
  async unloadAll(): Promise<void> {
    super.unloadAll();
    delete this.allLoaded;
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
  getAllLoadedCatalogues() {
    const id = this.gameSystem?.gameSystem.id;
    if (id) {
      return Object.values(this.catalogues[id]);
    }
    return [];
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

export function saveCatalogueInDb(data: Catalogue | BSICatalogue | BSIGameSystem) {
  const stringed = rootToJson(data);
  const isCatalogue = Boolean(data.gameSystemId);
  const isSystem = !isCatalogue;
  if (isSystem) {
    db.systems.put({
      content: JSON.parse(stringed),
      id: data.id,
    });
  } else {
    db.catalogues.put({
      content: JSON.parse(stringed),
      id: `${data.gameSystemId}-${data.id}`,
    });
  }
}
export async function do_zip<T extends OutputType>(nameInZip: string, content: string, type: T) {
  var zip = new JSZip();
  zip.file(nameInZip, content);
  const result = await zip.generateAsync({ type: type, compression: "DEFLATE" });
  return result;
}
export async function saveCatalogueInFiles(data: Catalogue | BSICatalogue | BSIGameSystem) {
  const path = data.fullFilePath;
  if (!path) {
    console.error(`No path included in the catalogue ${data.name} to save at`);
    return;
  }
  const extension = getExtension(path);
  if (path.endsWith(".json")) {
    const content = rootToJson(data);
    await writeFile(path, content);
  } else {
    const xml = convertToXml(data);
    const shouldZip = isZipExtension(extension);
    const name = filename(path);
    const nameInZip = name.replace(".gstz", ".gst").replace(".catz", ".cat");
    const content = shouldZip ? await do_zip(nameInZip, xml, "uint8array") : xml;
    await writeFile(path, content);
  }
}
export function saveCatalogue(data: Catalogue | BSICatalogue | BSIGameSystem) {
  if (globalThis.electron) {
    saveCatalogueInFiles(data);
  } else {
    saveCatalogueInDb(data);
  }
}

import { BSCatalogueManager } from "~/assets/shared/battlescribe/bs_system";
import {
  BSIDataSystem,
  BSIDataCatalogue,
  BSICatalogueLink,
  BSIData,
  BSICatalogue,
  BSIGameSystem,
} from "~/assets/shared/battlescribe/bs_types";
import { BooksDate } from "~/assets/shared/battlescribe/bs_versioning";
import { db } from "../dexie";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { rootToJson } from "~/assets/shared/battlescribe/bs_main";
import { convertToXml, getExtension, isZipExtension } from "~/assets/shared/battlescribe/bs_convert";
import { filename, writeFile } from "~/electron/node_helpers";
import JSZip, { OutputType } from "jszip";
import { GithubIntegration } from "./github";
import { loadData } from "~/assets/shared/battlescribe/bs_load_data";

export class GameSystemFiles extends BSCatalogueManager {
  gameSystem: BSIDataSystem | null = null;
  catalogueFiles: Record<string, BSIDataCatalogue> = {};
  allLoaded?: boolean;
  loadedCatalogues: Record<string, Catalogue> = {};
  github?: GithubIntegration;

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
    this.loadedCatalogues = {};
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
  getLoadedCatalogue(catalogueLink: BSICatalogueLink, booksDate?: BooksDate): Catalogue | undefined {
    const key = catalogueLink.targetId || catalogueLink.name!;
    return this.loadedCatalogues[key] as Catalogue | undefined;
  }
  addLoadedCatalogue(catalogue: Catalogue, booksDate?: BooksDate): void {
    this.loadedCatalogues[catalogue.id] = catalogue;
  }
  getAllLoadedCatalogues() {
    const id = this.gameSystem?.gameSystem.id;
    if (id) {
      return Object.values(this.loadedCatalogues);
    }
    return [];
  }
  getCatalogueInfo(catalogueLink: BSICatalogueLink): { name: string } | undefined {
    if (this.gameSystem?.gameSystem.id === catalogueLink.targetId) {
      return { name: this.gameSystem?.gameSystem.name };
    }
    for (const catalogue of Object.values(this.catalogueFiles)) {
      if (catalogue.catalogue.id === catalogueLink.targetId) {
        return { name: catalogue.catalogue.name };
      }
    }
  }

  getAllCatalogueFiles() {
    return [...(this.gameSystem ? [this.gameSystem] : []), ...Object.values(this.catalogueFiles)];
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
      path: data.fullFilePath,
      id: data.id,
    });
  } else {
    db.catalogues.put({
      content: JSON.parse(stringed),
      path: data.fullFilePath,
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

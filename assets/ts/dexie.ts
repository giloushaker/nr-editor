// db.ts
import Dexie, { Table } from "dexie";
import {
  BSIDataCatalogue,
  BSIDataSystem,
} from "../shared/battlescribe/bs_types";

export class MySubClassedDexie extends Dexie {
  catalogues!: Table<{ id: string; content: BSIDataCatalogue }>;
  systems!: Table<{ id: string; content: BSIDataSystem }>;

  constructor() {
    super("nr-editor");
    this.version(5).stores({
      catalogues: "id, content.catalogue.id",
      systems: "id",
    });
  }
}

export const db = new MySubClassedDexie();

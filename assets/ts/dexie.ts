// db.ts
import Dexie, { Table } from "dexie";
import {
  BSIDataCatalogue,
  BSIDataSystem,
} from "../shared/battlescribe/bs_types";

export class MySubClassedDexie extends Dexie {
  catalogues!: Table<BSIDataCatalogue>;
  systems!: Table<BSIDataSystem>;

  constructor() {
    super("nr-editor");
    this.version(2).stores({
      catalogues: "id",
      systems: "id",
    });
  }
}

export const db = new MySubClassedDexie();

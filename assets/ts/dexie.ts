// db.ts
import Dexie, { Table } from "dexie";

export class MySubClassedDexie extends Dexie {
  //catalogue_sets!: Table<ListRow>;

  constructor() {
    super("nr-editor");
    /*     this.version(1).stores({
      reports: "_id, id_tourny",
      tourny_lists: "list_key, id_tourny",
      lists: "list_key",
    }); */
  }
}

export const db = new MySubClassedDexie();

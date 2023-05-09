import { defineStore } from "pinia";
export interface ICataloguesState {
  dict: Record<
    string,
    {
      edited?: boolean;
      errors?: string[];
    }
  >;
}

export const useCataloguesStore = defineStore("catalogues", {
  state: (): ICataloguesState => ({
    dict: {},
  }),
  persist: true,
  actions: {
    get(id: string) {
      if (!(id in this.dict)) {
        this.dict[id] = {};
      }
      return this.dict[id];
    },
    setEdited(id: string, bool: boolean) {
      this.get(id).edited = bool;
    },
    getEdited(id: string) {
      return this.get(id).edited;
    },
    setErrors(id: string, msg: string[]) {
      this.get(id).errors = msg;
    },
    getErrors(id: string) {
      return this.get(id).errors;
    },
  },
});

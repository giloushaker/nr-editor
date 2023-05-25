import { defineStore } from "pinia";
export interface ICatalogueState {
  edited?: boolean;
  errors?: string[];
  dependencies?: Dependency[];
  dependents?: Dependency[];
}

export interface Dependency {
  id: string;
  source: string;
  type?: "import" | "link" | "condition";
}
/**
 * Stores info about catalogues, wich will be persisted to disk.
 */
export const useCataloguesStore = defineStore("catalogues", {
  state: () => ({
    dict: {} as Record<string, ICatalogueState>,
    version: 1,
  }),

  persist: {
    storage: localStorage,
  },
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
    getDependents(id: string) {
      return this.get(id).dependents;
    },
    setDependencies(id: string, dependencies: Dependency[]) {
      this.get(id).dependencies = dependencies;
    },
    setDependents(id: string, dependents: Dependency[]) {
      this.get(id).dependents = dependents;
    },
    addDependent(id: string, dependency: Dependency) {
      const state = this.get(id);
      if (!state.dependents) state.dependents = [];
      state.dependents.push(dependency);
    },
    removeDependent(id: string, dependency: Dependency) {
      const state = this.get(id);
      if (state.dependents) {
        state.dependents = state.dependents.filter((d) => d.id !== dependency.id);
      }
    },
  },
});

import { defineStore } from "pinia";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICatalogue, BSIDataCatalogue, BSIGameSystem } from "~/assets/shared/battlescribe/bs_types";
export interface ICatalogueState {
  edited?: boolean;
  errors?: string[];
  dependencies?: Dependency[];
  dependents?: Dependency[];
}

export interface Dependency {
  targetId: string;
  sourceId: string;
  sourceName?: string;
  importRootEntries?: boolean;
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
    storage: globalThis.localStorage,
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
    updateCatalogue(catalogue: Catalogue | BSICatalogue | BSIGameSystem) {
      const id = catalogue.id;
      const gstId = catalogue.gameSystemId || catalogue.id;
      const dependencies = catalogue.catalogueLinks?.map((o) => ({
        targetId: o.targetId === gstId ? gstId : `${gstId}-${o.targetId}`,
        sourceId: id === gstId ? gstId : `${gstId}-${id}`,
        importRootEntries: o.importRootEntries,
        sourceName: catalogue.name,
      }));
      if (catalogue.gameSystemId) {
        dependencies?.push({
          targetId: catalogue.gameSystemId,
          sourceId: id,
          importRootEntries: true,
          sourceName: catalogue.name,
        });
      }
      this.setDependencies(id, dependencies);
    },
    setDependencies(id: string, dependencies?: Dependency[]) {
      const previousDependencies = this.get(id)?.dependencies;
      if (previousDependencies) {
        for (const dependency of previousDependencies) {
          this.removeDependent(dependency.targetId, dependency);
        }
      }
      if (dependencies) {
        for (const dependency of dependencies) {
          this.addDependent(dependency.targetId, dependency);
        }
      }
      this.get(id).dependencies = dependencies || [];
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
      const dependents = this.get(id)?.dependents;
      if (dependents) {
        const idx = dependents.findIndex((o) => o.sourceId === dependency.sourceId);
        if (idx >= 0) dependents.splice(idx, 1);
      }
    },
  },
});

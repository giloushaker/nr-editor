import { defineStore } from "pinia";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    systemsFolder: "" as string | undefined,
    showOnlyEnabledCategories: false,
    sort: "asc" as string,
  }),

  persist: {
    storage: globalThis.localStorage,
  },
});

import { defineStore } from "pinia";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    systemsFolder: "" as string | undefined,
    showOnlyEnabledCategories: false,
  }),

  persist: {
    storage: globalThis.localStorage,
  },
});

import { defineStore } from "pinia";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    systemsFolder: "" as string | undefined,
  }),

  persist: {
    storage: globalThis.localStorage,
  },
});

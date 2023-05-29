import { defineStore } from "pinia";

export const useUIState = defineStore("ui", {
  state: () => ({} as Record<string, number>),

  persist: {
    storage: globalThis.localStorage,
  },
  actions: {
    get(splitViewId: string, subId: string): number | undefined {
      return this.$state[`${splitViewId}-${subId}`];
    },
    set(splitViewId: string, subId: string, value: number) {
      this.$state[`${splitViewId}-${subId}`] = value;
    },
  },
});

import { defineStore } from "pinia";

export const usePromptStore = defineStore("ui", {
  state: () => ({} as Record<string, number>),

  persist: {
    storage: globalThis.localStorage,
  },
  actions: {
    get(id: string): number | undefined {
      return this.$state[id];
    },
    set(id: string, value: number) {
      this.$state[id] = value;
    },
  },
});

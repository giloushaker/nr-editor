import { defineStore } from "pinia";

export const usePromptStore = defineStore("prompts", {
  state: () => ({} as Record<string, boolean>),

  persist: {
    storage: globalThis.localStorage,
  },
  actions: {
    get(id: string): boolean | undefined {
      return this.$state[id];
    },
    set(id: string, value: boolean) {
      this.$state[id] = value;
    },
  },
});

<template>
  <div>
    <div>
      <label for="theme">Theme: </label>
      <select id="theme" v-model="settings.theme">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
    <div class="row">
      <input type="checkbox" id="global-duplicate-id-error" v-model="settings.globalDuplicateIdError" />
      <label for="global-duplicate-id-error">Check for duplicate ids across all catalogues (requires reload)</label>
    </div>
    <div class="row">
      <input type="checkbox" id="github-auto-increment" v-model="settings.githubAutoIncrement" />
      <label for="github-auto-increment"
        >Auto increment revision when saving (requires github integration & internet)</label
      >
    </div>
    <div class="row">
      <input type="checkbox" id="revision-popup" v-model="noRevisionPopup" />
      <label for="revision-popupt">Don't show popups asking to increment revision</label>
    </div>
    <div class="row">
      <input type="checkbox" id="categories-ui-v2" v-model="settings.useNewCategoriesUI" />
      <label for="categories-ui-v2">Use new ui for categories</label>
    </div>
  </div>
</template>
<script>
import { useSettingsStore } from "~/stores/settingsState";
import { usePromptStore } from "~/stores/promptStore";

export default {
  setup() {
    return { settings: useSettingsStore(), prompt: usePromptStore() };
  },
  computed: {
    noRevisionPopup: {
      get() {
        this.prompt.get("revision");
      },
      set(val) {
        this.prompt.set("revision", val);
      },
    },
  },
};
</script>
<style lang="scss">
.row {
  display: flex;
  flex-direction: row;
}
</style>

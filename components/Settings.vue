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
      <label for="github-auto-increment">Auto increment revision when saving (requires github integration &
        internet)</label>
    </div>
    <div class="row">
      <input type="checkbox" id="revision-popup" v-model="noRevisionPopup" />
      <label for="revision-popupt">Don't show popups asking to increment revision</label>
    </div>
    <div class="row">
      <input type="checkbox" id="categories-ui-v2" v-model="settings.useNewCategoriesUI" />
      <label for="categories-ui-v2">Use new UI for categories</label>
    </div>
    <div class="row">
      <input type="checkbox" id="auto-format" v-model="settings.autoFormatCharacteristics" />
      <label for="auto-format">Automatically format characteristics on paste</label>
    </div>
    <div class="row">
      <input type="checkbox" id="auto-rename" v-model="settings.autoRenameInfoLinkParent" />
      <label for="auto-rename">Automatically rename parent entry when assigning info links</label>
    </div>
    <fieldset class="mt-10px">
      <legend>Display</legend>
      <div class="row">
        <input type="checkbox" id="sort" v-model="settings.display.sortIndex" />
        <label for="">Sort Index</label>
      </div>
      <div class="row">
        <input type="checkbox" id="refs" v-model="settings.display.references" />
        <label for="refs">Refs</label>
      </div>
      <div class="row">
        <input type="checkbox" id="costs" v-model="settings.display.costs" />
        <label for="">Costs</label>
      </div>
      <div class="row">
        <input type="checkbox" id="costs" v-model="settings.display.primaryCategory" />
        <label for="">Primary Category</label>
      </div>
    </fieldset>
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
        return this.prompt.get("revision");
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

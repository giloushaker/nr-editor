<template>
  <div>
    <div>
      <label for="theme">Theme: </label>
      <select id="theme" v-model="settings.theme">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
    <div>
      <input type="checkbox" id="global-duplicate-id-error" v-model="settings.globalDuplicateIdError" />
      <label for="global-duplicate-id-error">Check for duplicate ids across all catalogues (requires reload)</label>
    </div>
  </div>
</template>
<script>
import { useSettingsStore } from "~/stores/settingsState";

export default {
  setup() {
    return { settings: useSettingsStore() };
  },
};
</script>

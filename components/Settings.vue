<template>
  <div>
    <label for="theme">Theme: </label>
    <select id="theme" v-model="settings.theme">
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
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

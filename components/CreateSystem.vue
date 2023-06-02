<template>
  <span>
    <button class="bouton" @click="click"> Create System </button>
    <PopupDialog class="create-system-popup" v-if="open" v-model="open" button="Create" @button="create">
      <h2 class="text-center">Create System</h2>
      <span>Name: </span>
      <input class="w-full" type="text" v-model="text" required />
      <div> The system will be created at: </div>
      <div class="gray">{{ folder }}/{{ text }}/</div>
    </PopupDialog>
  </span>
</template>
<script lang="ts">
import { removeSuffix } from "~/assets/shared/battlescribe/bs_helpers";
import { useEditorStore } from "~/stores/editorStore";
import { useSettingsStore } from "~/stores/settingsState";

export default {
  emits: ["created"],
  data() {
    return { open: false, text: "" };
  },
  setup() {
    return { store: useEditorStore(), settings: useSettingsStore() };
  },
  computed: {
    folder() {
      if (!this.settings.systemsFolder) {
        return "";
      }
      const folder = `${removeSuffix(this.settings.systemsFolder.replaceAll("\\", "/"), "/")}`;
      return folder;
    },
  },
  methods: {
    click() {
      this.text = "";
      this.open = true;
    },

    async create() {
      if (this.text && this.settings.systemsFolder) {
        const created = await this.store.create_system(this.text, this.settings.systemsFolder);
        this.$emit("created", created);
      }
    },
  },
};
</script>
<style scoped>
.create-system-popup {
  text-align: center;
}
</style>

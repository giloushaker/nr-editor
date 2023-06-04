<template>
  <button class="bouton" @click="click"> Create System </button>
  <PopupDialog v-if="open" v-model="open" button="Create" @button="create">
    <h2 class="text-center">Create System</h2>
    <span>Name </span>
    <input class="w-full" type="text" v-model="text" required />
    <template v-if="electron">
      <div> The system will be created at: </div>
      <div class="gray">{{ folder }}/{{ text }}/</div>
    </template>
  </PopupDialog>
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
    electron() {
      return Boolean(globalThis.electron);
    },
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
      if (this.text) {
        const created = await this.store.create_system(this.text, this.folder);
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

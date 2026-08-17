<template>
  <button @click="popFileInput" class="bouton" :disabled="uploading" v-if="available">
    <template v-if="!uploading">Set Working Folder</template>
    <template v-else> ... </template>
  </button>
  <span v-else>Folder access requires the desktop app, or a browser supporting the File System Access API (Chrome, Edge)</span>
</template>

<script lang="ts">
import { showOpenDialog } from "~/electron/node_helpers";
import { pickFolder, supported } from "~/electron/web_fs";
export default {
  emits: ["selected"],
  data() {
    return {
      uploading: false,
    };
  },
  computed: {
    available() {
      return Boolean(globalThis.electron) || supported();
    },
  },
  methods: {
    async popFileInput() {
      try {
        this.uploading = true;
        if (globalThis.electron) {
          const result = await showOpenDialog({
            properties: ["openDirectory"],
          });
          if (result?.filePaths?.length) {
            this.$emit("selected", result.filePaths);
          }
        } else {
          const name = await pickFolder();
          if (name) {
            this.$emit("selected", [name]);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        this.uploading = false;
      }
    },
  },
};
</script>
<style scoped lang="scss">
.invisible {
  opacity: 0; /* make transparent */
  z-index: -1; /* move under anything else */
  position: absolute; /* don't let it take up space */
}
</style>

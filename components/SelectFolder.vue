<template>
  <button @click="popFileInput" class="bouton" :disabled="uploading" v-if="electron">
    <template v-if="!uploading">Change Folder</template>
    <template v-else> ... </template>
  </button>
  <span v-else>&lt;SelectFolder&gt; is only available in electron app</span>
</template>

<script lang="ts">
import { showOpenDialog } from "~/electron/node_helpers";
export default {
  emits: ["selected"],
  data() {
    return {
      uploading: false,
    };
  },
  computed: {
    electron() {
      return Boolean(global.electron);
    },
  },
  methods: {
    async popFileInput() {
      if (!globalThis.electron) {
        throw new Error("SelectFile is for use in electron app only");
      }
      try {
        this.uploading = true;
        const result = await showOpenDialog({
          properties: ["openDirectory"],
        });
        if (result?.filePaths?.length) {
          this.$emit("selected", result.filePaths);
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

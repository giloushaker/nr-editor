<template>
  <button @click="popFileInput" class="bouton" :disabled="uploading" v-if="electron">
    <template v-if="!uploading"> Import </template>
    <template v-else> ... </template>
  </button>
  <span v-else>&lt;SelectFile&gt; is only available in electron app</span>
</template>

<script lang="ts">
import { convertToJson, getExtension, isAllowedExtension } from "~/assets/shared/battlescribe/bs_convert";
import { getDataObject } from "~/assets/shared/battlescribe/bs_system";
import { getFolderFiles, showOpenDialog } from "~/electron/node_helpers";
export default {
  emits: ["uploaded"],
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
    async onFilesSelected(filePaths: string[]) {
      const result_files = [] as Object[];
      if (!filePaths.length) return;
      filePaths = [filePaths[0]];
      for (const path of filePaths) {
        const files = await getFolderFiles(path);
        if (!files?.length) return;
        for (const file of files.filter((o) => isAllowedExtension(o.name))) {
          const asJson = await convertToJson(file.data, getExtension(file.name));
          (getDataObject(asJson) as any).fullFilePath = file.path;
          result_files.push(asJson);
        }
      }
      if (result_files.length) {
        this.$emit("uploaded", result_files);
      }
    },
    async popFileInput() {
      if (!globalThis.electron) {
        throw new Error("SelectFile is for use in electron app only");
      }
      try {
        this.uploading = true;
        const result = await showOpenDialog({
          properties: ["openFile"],
        });
        if (result?.filePaths?.length) {
          await this.onFilesSelected(result.filePaths);
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

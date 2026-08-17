<template>
  <button @click="popFileInput" class="bouton" :disabled="uploading" v-if="available">
    <template v-if="!uploading"> Load System </template>
    <template v-else> ... </template>
  </button>
  <span v-else>&lt;SelectFile&gt; requires the desktop app or a browser supporting the File System Access API</span>
</template>

<script lang="ts">
import { convertToJson, getExtension, isAllowedExtension } from "~/assets/shared/battlescribe/bs_convert";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { getFolderFiles, showOpenDialog } from "~/electron/node_helpers";
import { pickFiles, supported } from "~/electron/web_fs";
export default {
  emits: ["uploaded"],
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
    async emitFiles(files: Array<{ name: string; path: string; data: string }>) {
      const result_files = [] as Object[];
      for (const file of files.filter((o) => isAllowedExtension(o.name))) {
        const asJson = await convertToJson(file.data, getExtension(file.name));
        getDataObject(asJson).fullFilePath = file.path.replaceAll("\\", "/");
        result_files.push(asJson);
      }
      if (result_files.length) {
        this.$emit("uploaded", result_files);
      }
    },
    async onFilesSelected(filePaths: string[]) {
      if (!filePaths.length) return;
      const files = await getFolderFiles(filePaths[0]);
      if (!files?.length) return;
      await this.emitFiles(files);
    },
    async popFileInput() {
      try {
        this.uploading = true;
        if (globalThis.electron) {
          const result = await showOpenDialog({
            properties: ["openFile"],
          });
          if (result?.filePaths?.length) {
            await this.onFilesSelected(result.filePaths);
          }
        } else {
          await this.emitFiles(await pickFiles());
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

<template>
  <button @click="popFileInput" class="bouton" :disabled="uploading">
    <template v-if="!uploading"> Import Catalogues </template>
    <template v-else> ... </template>
  </button>
</template>

<script setup lang="ts">
import {
  convertToJson,
  getExtension,
  isAllowedExtension,
  isZipExtension,
} from "~/assets/shared/battlescribe/bs_convert";
import { getDataObject } from "~/assets/shared/battlescribe/bs_system";
import { getFolderFiles, showOpenDialog } from "~/electron/node_helpers";
const uploading = ref(false);
const emit = defineEmits<{
  (e: "uploaded", files: Object[]): void;
}>();

async function onFilesSelected(filePaths: string[]) {
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
    emit("uploaded", result_files);
  }
}
async function popFileInput() {
  if (!globalThis.electron) {
    throw new Error("SelectFile is for use in electron app only");
  }
  try {
    uploading.value = true;
    const result = await showOpenDialog({
      properties: ["openFile"],
    });
    if (result?.filePaths?.length) {
      await onFilesSelected(result.filePaths);
      uploading.value = false;
    }
  } catch (e) {
    console.error(e);
    uploading.value = false;
    return;
  }
}
</script>
<style scoped lang="scss">
.invisible {
  opacity: 0; /* make transparent */
  z-index: -1; /* move under anything else */
  position: absolute; /* don't let it take up space */
}
</style>

<template>
  <input
    type="file"
    accept=".gst, .gstz, .xml, .zip, .cat, .catz, .json"
    multiple
    @change="onFileSelected"
    class="invisible"
    ref="fileinput"
  />
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
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
const fileinput = ref(null);
const uploading = ref(false);
const emit = defineEmits<{
  (e: "uploaded", files: Object[]): void;
}>();

async function onFileSelected(event: any) {
  try {
    uploading.value = true;
    const input_files = [...((event.target?.files as FileList | null) || [])];
    if (!input_files) {
      uploading.value = false;
      return;
    }

    const result_files = [] as Object[];
    for (const file of input_files.filter((o) => isAllowedExtension(o.name))) {
      const content = isZipExtension(file.name) ? await file.arrayBuffer() : await file.text();
      const asJson = await convertToJson(content, getExtension(file.name));
      const obj = ((getDataObject(asJson) as any).fullFilePath = "none");
      result_files.push(asJson);
    }
    if (result_files.length) {
      emit("uploaded", result_files);
    }
    uploading.value = false;
  } catch (e) {
    console.error(e);
    uploading.value = false;
  }
}
async function popFileInput() {
  (fileinput.value as any).click();
}
</script>
<style scoped lang="scss">
.invisible {
  opacity: 0; /* make transparent */
  z-index: -1; /* move under anything else */
  position: absolute; /* don't let it take up space */
}
</style>

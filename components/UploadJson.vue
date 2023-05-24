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
import { convertToJson, getExtension, isAllowedExtension } from "~/assets/shared/battlescribe/bs_convert";
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
      return;
    }

    const result_files = [] as Object[];
    for (const file of input_files.filter((o) => isAllowedExtension(o.name))) {
      const asJson = await convertToJson(await file.text(), getExtension(file.name));
      result_files.push(asJson);
    }
    if (result_files.length) {
      emit("uploaded", result_files);
    }
  } finally {
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

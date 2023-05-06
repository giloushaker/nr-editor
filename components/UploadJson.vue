<template>
  <input
    type="file"
    accept=".gst, .gstz, .xml, .zip, .cat, .catz, .json"
    multiple
    @change="onFileSelected"
    class="invisible"
    ref="fileinput"
  />
  <button @click="popFileInput" class="bouton">Import Catalogues</button>
</template>

<script setup lang="ts">
import { convertToJson } from "~/assets/shared/battlescribe/bs_convert";
const allowedExtensions = ["gst", "gstz", "xml", "zip", "cat", "catz", "json"];
const emit = defineEmits<{
  (e: "uploaded", files: any[]): void;
}>();

async function onFileSelected(event: any) {
  const files = [];
  const event_files = event.target?.files as FileList | null;
  if (!event_files) return;

  for (const current_file of event_files) {
    // Check if the file extension is allowed
    const fileExtension = current_file.name.split(".").pop()!.toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      alert(
        "Invalid file type. Allowed file types: .gst, .gstz, .xml, .zip, .cat, .catz, .json"
      );
      return;
    }
    const asJson = await convertToJson(
      await current_file.arrayBuffer(),
      fileExtension
    );
    files.push(asJson);
  }
  if (files.length) emit("uploaded", files);
}
</script>
<script lang="ts">
export default {
  methods: {
    async popFileInput() {
      if (this.$refs.fileinput) {
        (this.$refs.fileinput as any).click();
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

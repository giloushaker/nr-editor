<script setup lang="ts">
import { removeSuffix } from "~/assets/shared/battlescribe/bs_helpers";
import {
  convertToJson,
  getExtension,
  isAllowedExtension,
  unzipFolder,
} from "~/assets/shared/battlescribe/bs_convert";

const url = ref("");
const emit = defineEmits<{
  (e: "uploaded", files: Object[]): void;
}>();
async function submit(url: string) {
  if (!url) {
    return;
  }
  try {
    // Check if url is valid
    new URL(url);
    url = removeSuffix(url, "/");

    // Get the zip of the repo's zip:
    // https://github.com/BSData/wh40k -> https://github.com/BSData/wh40k/archive/refs/heads/master.zip
    const repoPath = url.split("/").slice(-2).join("/"); // BSData/wh40k
    const repoName = repoPath.split("/")[1];
    const apiUrl = `https://api.github.com/repos/${repoPath}`;
    const defaultBranch = (await $fetch<any>(apiUrl)).default_branch; // master

    // Download the zip through a cors proxy
    const zipDlUrl = `https://codeload.github.com/${repoPath}/zip/refs/heads/${defaultBranch}`;
    const zipFile = await $fetch<Blob>(`https://corsproxy.io/?${zipDlUrl}`);
    const folder = await unzipFolder(zipFile, `${repoName}-${defaultBranch}`);

    // Extract the useful files
    const result_files = [] as Object[];
    for (const [name, content] of Object.entries(folder)) {
      if (isAllowedExtension(name)) {
        result_files.push(await convertToJson(content, getExtension(name)));
      }
    }
    if (result_files.length) {
      emit("uploaded", result_files);
    }
  } catch (e) {
    console.error(e);
    // Invalid url
  }
}
</script>
<template>
  <input
    type="url"
    class="bouton"
    v-model="url"
    placeholder="https://github.com/BSData/wh40k"
  />
  <button @click="submit(url)" class="bouton">Submit</button>
</template>

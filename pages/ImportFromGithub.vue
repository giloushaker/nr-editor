<script setup lang="ts">
import { removeSuffix } from "~/assets/shared/battlescribe/bs_helpers";
import {
  convertToJson,
  getExtension,
  isAllowedExtension,
  unzipFolder,
} from "~/assets/shared/battlescribe/bs_convert";

const inputUrl = ref("");
const busy = ref(false);
const emit = defineEmits<{
  (e: "uploaded", files: Object[]): void;
}>();
async function submit(url: string | null) {
  if (!url || normalizeGithubRepoUrl(url) !== url) {
    console.log("bad url", url);
    return;
  }
  try {
    busy.value = true;
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
    inputUrl.value = "";
  } catch (e) {
    console.error(e);

    // Invalid url
  } finally {
    busy.value = false;
  }
}
function normalizeGithubRepoUrl(input: string): string | null {
  const githubUrlRegex =
    /^(?:(http(s?)?:\/\/)?github.com\/)?([^\/]+)\/([^\/]+)$/;
  const match = input.match(githubUrlRegex);

  if (!match) {
    return null;
  }

  const [, protocol = "https://", _, user, repo] = match;

  if (!user || !repo) {
    return null;
  }

  return `${protocol}github.com/${user}/${repo}`;
}
</script>
<template>
  <input
    type="url"
    class="bouton"
    v-model="inputUrl"
    placeholder="BSData/wh40k"
  />
  <button
    @click="submit(normalizeGithubRepoUrl(inputUrl))"
    class="bouton"
    :disabled="normalizeGithubRepoUrl(inputUrl) == null || busy"
  >
    {{ busy ? "..." : "Import from github" }}
  </button>
</template>

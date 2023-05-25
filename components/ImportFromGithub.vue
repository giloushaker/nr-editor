<script setup lang="ts">
import { convertToJson, getExtension, isAllowedExtension, unzipFolder } from "~/assets/shared/battlescribe/bs_convert";

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
    // Get the zip of the repo:
    const repoPath = url.split("/").slice(-2).join("/"); // BSData/wh40k
    const repoName = repoPath.split("/")[1];
    const apiUrl = `https://api.github.com/repos/${repoPath}`;
    const defaultBranch = (await $fetch<any>(apiUrl)).default_branch; // master
    const zipDlUrl = `https://codeload.github.com/${repoPath}/zip/refs/heads/${defaultBranch}`;

    // Download the zip through a cors proxy
    const zipFile = await $fetch<Blob>(`https://corsproxy.io/?${zipDlUrl}`);

    // Extract the useful files
    const folder = await unzipFolder(zipFile, `${repoName}-${defaultBranch}`);
    const result_files = [] as Object[];
    for (const [name, content] of Object.entries(folder)) {
      const extension = getExtension(name);
      if (isAllowedExtension(extension)) {
        result_files.push(await convertToJson(content, extension));
      }
    }
    if (result_files.length) {
      emit("uploaded", result_files);
    }
    inputUrl.value = "";
  } catch (e) {
    console.error(e);
  } finally {
    busy.value = false;
  }
}
function normalizeGithubRepoUrl(input: string): string | null {
  const githubUrlRegex = /^(?:(http(s?)?:\/\/)?github.com\/)?([^\/]+)\/([^\/]+)$/;
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
  <input ype="url" class="bouton !font-normal" v-model="inputUrl" placeholder="BSData/wh40k" />
  <button
    @click="submit(normalizeGithubRepoUrl(inputUrl))"
    class="bouton"
    :disabled="normalizeGithubRepoUrl(inputUrl) == null || busy"
  >
    {{ busy ? "..." : "Import from github" }}
  </button>
</template>

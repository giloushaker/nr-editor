<template>
  <span class="ml-5px align-bottom imgBt inline-block" title="Create a Pull Request with your changes" @click="open = true">
    <img class="w-24px h-24px" src="assets/icons/github-light.png" />
    <span class="align-middle">PR</span>
  </span>
  <PopupDialog v-if="open" v-model="open" :button="busy ? '...' : 'Create Pull Request'" :disabled="busy || !files.length || !token" @button="create">
    <h2 class="text-center">Create Pull Request</h2>
    <div>
      Target: <span class="bold">{{ github?.githubRepo || github?.githubUrl }}</span>
    </div>
    <div class="mt-10px">
      <template v-if="files.length">
        <div>Changed files:</div>
        <ul>
          <li v-for="file in files">{{ fileLabel(file) }}</li>
        </ul>
      </template>
      <div v-else class="gray">No changed catalogues in this system (changes are tracked after you save).</div>
    </div>
    <div class="mt-10px">
      <span>Github Token </span>
      <InfoButton>
        Create a token at
        <a href="https://github.com/settings/tokens/new?scopes=public_repo&description=NR-Editor" target="_blank">
          github.com/settings/tokens</a>
        with the <span class="bold">public_repo</span> scope. It is stored in your browser's localStorage. If you lack
        push access to the repo, a fork is created on your account automatically.
      </InfoButton>
      <input class="w-full" type="password" v-model="token" placeholder="ghp_..." />
    </div>
    <div class="mt-10px">
      <span>Title </span>
      <input class="w-full" type="text" v-model="title" />
    </div>
    <div class="mt-10px">
      <span>Description </span>
      <textarea class="w-full" rows="4" v-model="body" />
    </div>
    <div v-if="error" class="text-red mt-10px">{{ error }}</div>
    <div v-if="prUrl" class="mt-10px">
      Created: <a :href="prUrl" target="_blank">{{ prUrl }}</a>
    </div>
  </PopupDialog>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { getDataObject, getDataDbId } from "~/assets/shared/battlescribe/bs_main";
import { parseGitHubUrl } from "~/assets/shared/battlescribe/github";
import { createDataPR, type PRFileChange } from "~/assets/ts/github_pr";
import { serializeCatalogueFile, useEditorStore } from "~/stores/editorStore";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useSettingsStore } from "~/stores/settingsState";
import type { BSIData } from "~/assets/shared/battlescribe/bs_types";
import PopupDialog from "~/shared_components/PopupDialog.vue";
import InfoButton from "~/components/InfoButton.vue";

export default {
  components: { PopupDialog, InfoButton },
  props: {
    system: { type: Object as PropType<GameSystemFiles>, required: true },
  },
  data() {
    return {
      open: false,
      busy: false,
      error: "",
      prUrl: "",
      title: "",
      body: "Created with NR-Editor",
    };
  },
  setup() {
    return { store: useEditorStore(), cataloguesStore: useCataloguesStore(), settings: useSettingsStore() };
  },
  created() {
    this.title = `Update ${this.system.gameSystem?.gameSystem.name || "data"}`;
  },
  computed: {
    token: {
      get(): string {
        return this.settings.githubToken;
      },
      set(value: string) {
        this.settings.githubToken = value;
      },
    },
    github() {
      const github = this.system.github;
      if (!github) return undefined;
      if (github.githubOwner) return github;
      try {
        return { ...github, ...parseGitHubUrl(github.githubUrl) };
      } catch {
        return undefined;
      }
    },
    files(): BSIData[] {
      return this.system
        .getAllCatalogueFiles()
        .filter((file) => this.cataloguesStore.getEdited(getDataDbId(file)) && getDataObject(file).fullFilePath);
    },
  },
  methods: {
    fileLabel(file: BSIData) {
      const obj = getDataObject(file);
      return `${obj.name} (${obj.fullFilePath!.replaceAll("\\", "/").split("/").pop()})`;
    },
    async create(button: { close: boolean | Promise<boolean> }) {
      button.close = (async () => {
        this.error = "";
        this.prUrl = "";
        this.busy = true;
        try {
          const changes = [] as PRFileChange[];
          for (const file of this.files) {
            const obj = getDataObject(file);
            const content = await serializeCatalogueFile(obj);
            if (content !== undefined) {
              changes.push({ path: obj.fullFilePath!, content });
            }
          }
          const url = await createDataPR({
            token: this.token,
            owner: this.github!.githubOwner!,
            repo: this.github!.githubName!,
            files: changes,
            title: this.title,
            body: this.body,
            branch: `nr-editor-${Date.now()}`,
          });
          this.prUrl = url;
          for (const file of this.files) {
            this.cataloguesStore.setEdited(getDataDbId(file), false);
          }
          notify(`Pull request created`);
          window.open(url, "_blank");
          return false; // keep the dialog open to show the link
        } catch (e: any) {
          this.error = e?.message || String(e);
          return false;
        } finally {
          this.busy = false;
        }
      })();
    },
  },
};
</script>

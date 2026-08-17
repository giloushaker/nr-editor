<template>
  <PopupDialog v-if="modelValue" :modelValue="modelValue" @update:modelValue="$emit('update:modelValue', $event)" x>
    <template #header>Import from GitHub</template>
    <p class="dsub">Browse known data repos, or paste any <b>owner/repo</b>.</p>
    <input class="w-full" type="text" v-model="query" placeholder='Search, or paste "owner/repo"' />

    <div v-if="selected" class="picked">
      <div class="rn">{{ selected.github }}</div>
      <div class="rd" v-if="selected.label">{{ selected.label }}</div>
      <div class="refrow" v-if="!refsLoading">
        <select v-model="ref">
          <optgroup label="Branches" v-if="branches.length">
            <option v-for="b in branches" :key="'b' + b" :value="b">{{ b }}</option>
          </optgroup>
          <optgroup label="Tags" v-if="tags.length">
            <option v-for="t in tags" :key="'t' + t" :value="t">{{ t }}</option>
          </optgroup>
        </select>
        <button class="bouton" :disabled="busy || !ref" @click="doImport">
          {{ busy ? "Importing..." : "Import" }}
        </button>
      </div>
      <div v-else class="gray">Loading branches…</div>
    </div>

    <div class="repolist">
      <div v-if="pasteCandidate" class="repo" @click="select({ github: pasteCandidate })">
        <div class="rn">{{ pasteCandidate }}</div>
        <div class="rd">Use this repo</div>
      </div>
      <div v-for="repo in filtered" :key="repo.github" class="repo" @click="select(repo)">
        <div class="rn">{{ repo.github }}</div>
        <div class="rd">{{ repo.label }}</div>
      </div>
      <div v-if="!filtered.length && !pasteCandidate" class="gray p-4px">
        No match — paste an owner/repo to import any repository.
      </div>
    </div>

    <div v-if="error" class="text-red mt-4px">{{ error }}</div>
    <div class="dfoot">
      Repo list: BSData gallery + <span class="mono">assets/data/extra_repos.json</span>. A GitHub token in Settings
      raises the API rate limit and enables pull requests.
    </div>
  </PopupDialog>
</template>

<script lang="ts">
import PopupDialog from "~/shared_components/PopupDialog.vue";
import { convertToJson, getExtension, isAllowedExtension, isZipExtension } from "~/assets/shared/battlescribe/bs_convert";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { getRepoZip } from "~/assets/shared/battlescribe/github";
import { useSettingsStore } from "~/stores/settingsState";
import extraRepos from "~/assets/data/extra_repos.json";

interface RepoEntry {
  github: string; // owner/repo
  label?: string;
  archived?: boolean;
}

const GALLERY_URL = "https://bsdata.github.io/gallery/bsdata.catpkg-gallery.json";
const GALLERY_CACHE_KEY = "nr-editor-gallery";
const GALLERY_TTL = 24 * 3600 * 1000;

function parseOwnerRepo(url: string): string | undefined {
  const match = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/.exec(url || "");
  return match ? `${match[1]}/${match[2]}` : undefined;
}

export default {
  components: { PopupDialog },
  props: { modelValue: { type: Boolean, required: true } },
  emits: ["update:modelValue", "uploaded"],
  data() {
    return {
      query: "",
      repos: [] as RepoEntry[],
      selected: null as RepoEntry | null,
      branches: [] as string[],
      tags: [] as string[],
      ref: "",
      refsLoading: false,
      busy: false,
      error: "",
    };
  },
  setup() {
    return { settings: useSettingsStore() };
  },
  async created() {
    this.repos = [...(extraRepos as RepoEntry[])];
    try {
      const cached = JSON.parse(localStorage.getItem(GALLERY_CACHE_KEY) || "null");
      if (cached && Date.now() - cached.time < GALLERY_TTL) {
        this.mergeRepos(cached.repos);
        return;
      }
    } catch {}
    try {
      const index = await (await fetch(GALLERY_URL)).json();
      const repos = (index.repositories || [])
        .map((r: any) => ({
          github: parseOwnerRepo(r.githubUrl),
          label: r.description || r.name,
          archived: r.archived,
        }))
        .filter((r: RepoEntry) => r.github && !r.archived);
      localStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify({ time: Date.now(), repos }));
      this.mergeRepos(repos);
    } catch (e) {
      console.error("Failed to load BSData gallery", e);
    }
  },
  computed: {
    filtered(): RepoEntry[] {
      const q = this.query.trim().toLowerCase();
      const list = q
        ? this.repos.filter((r) => r.github.toLowerCase().includes(q) || r.label?.toLowerCase().includes(q))
        : this.repos;
      return list.slice(0, 30);
    },
    pasteCandidate(): string | undefined {
      const q = this.query.trim().replace(/^https?:\/\/(www\.)?github\.com\//, "");
      if (/^[\w.-]+\/[\w.-]+$/.test(q) && !this.repos.some((r) => r.github.toLowerCase() === q.toLowerCase())) {
        return q;
      }
    },
  },
  methods: {
    mergeRepos(repos: RepoEntry[]) {
      const known = new Set(this.repos.map((r) => r.github.toLowerCase()));
      for (const repo of repos) {
        if (!known.has(repo.github.toLowerCase())) this.repos.push(repo);
      }
    },
    ghHeaders(): Record<string, string> {
      const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
      if (this.settings.githubToken) headers["Authorization"] = `Bearer ${this.settings.githubToken}`;
      return headers;
    },
    async select(repo: RepoEntry) {
      this.selected = repo;
      this.error = "";
      this.refsLoading = true;
      this.branches = [];
      this.tags = [];
      this.ref = "";
      try {
        const [branches, tags] = await Promise.all([
          fetch(`https://api.github.com/repos/${repo.github}/branches?per_page=100`, { headers: this.ghHeaders() }).then(
            (r) => r.json(),
          ),
          fetch(`https://api.github.com/repos/${repo.github}/tags?per_page=100`, { headers: this.ghHeaders() }).then(
            (r) => r.json(),
          ),
        ]);
        if (branches.message) throw new Error(branches.message);
        this.branches = branches.map((b: any) => b.name);
        this.tags = Array.isArray(tags) ? tags.map((t: any) => t.name) : [];
        this.ref =
          this.branches.find((b) => b === "main" || b === "master") || this.branches[0] || this.tags[0] || "";
      } catch (e: any) {
        this.error = `Couldn't list branches: ${e?.message || e}`;
      } finally {
        this.refsLoading = false;
      }
    },
    async doImport() {
      if (!this.selected || !this.ref) return;
      this.busy = true;
      this.error = "";
      try {
        const [owner, name] = this.selected.github.split("/");
        const entries = await getRepoZip(owner, name, this.ref);
        const files = [] as object[];
        for (const [path, entry] of entries) {
          if (!isAllowedExtension(path)) continue;
          try {
            const data = isZipExtension(path) ? await entry.arrayBuffer() : await entry.text();
            const json = await convertToJson(data, getExtension(path));
            getDataObject(json).fullFilePath = path;
            files.push(json);
          } catch (e) {
            console.error(`Skipping ${path}`, e);
          }
        }
        if (!files.length) throw new Error("No BattleScribe data files found in this repo/ref");
        this.$emit("uploaded", files);
        this.$emit("update:modelValue", false);
      } catch (e: any) {
        this.error = e?.message || String(e);
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.dsub {
  color: gray;
  font-size: 13px;
  margin: 4px 0 8px;
}
.picked {
  background: rgba(100, 140, 200, 0.12);
  border-radius: 6px;
  padding: 10px 12px;
  margin: 10px 0;
  .refrow {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    select {
      max-width: 260px;
    }
  }
}
.repolist {
  max-height: 280px;
  overflow-y: auto;
  margin-top: 8px;
  border-top: 1px solid rgba(128, 128, 128, 0.25);
}
.repo {
  padding: 7px 4px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.18);
  cursor: pointer;
  &:hover {
    background: rgba(128, 128, 128, 0.12);
  }
}
.rn {
  font-family: monospace;
  font-size: 13px;
  font-weight: 600;
}
.rd {
  font-size: 12px;
  color: gray;
}
.dfoot {
  font-size: 11.5px;
  color: gray;
  margin-top: 10px;
  border-top: 1px solid rgba(128, 128, 128, 0.25);
  padding-top: 8px;
}
.mono {
  font-family: monospace;
}
</style>

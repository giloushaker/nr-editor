<template>
  <div class="scrollable roster" v-if="!loading">
    <div class="head">
      <h1 class="brand">Systems</h1>
      <input class="search" type="text" v-model="query" placeholder="Search systems…" />
      <div class="addwrap">
        <button class="add" @click.stop="menuOpen = !menuOpen">+ Add system ▾</button>
        <div v-if="menuOpen" class="menu" @click.stop>
          <button class="mitem" @click="githubOpen = true; menuOpen = false">Import from GitHub</button>
          <button class="mitem" v-if="folderSupported" @click="chooseFolder(); menuOpen = false">Choose folder</button>
          <UploadJson class="mitem" @uploaded="uploaded" />
          <CreateSystem class="mitem" @created="update" />
          <SelectFile v-if="isElectron" class="mitem" @uploaded="uploaded" />
        </div>
      </div>
    </div>

    <div class="subline" v-if="folderSupported && settings.systemsFolder">
      Working folder: <b>{{ settings.systemsFolder }}</b> · <u @click="chooseFolder">change</u> ·
      <u @click="update()">refresh</u>
    </div>

    <div class="banner info" v-if="!isElectron && !fsaSupported">
      This browser can't edit local folders. For folder editing use a
      <b>Chromium-based browser — Chrome, Edge, Brave, or Opera</b> — which support the File System Access API. GitHub
      import and file import work everywhere.
    </div>

    <div class="banner warn" v-if="needsPermission">
      🔒 Your browser forgot its permission for <b>{{ settings.systemsFolder }}</b
      >. One click restores it — your files are untouched.
      <button class="grant" @click="grantAccess">Grant access</button>
    </div>

    <div class="list" v-if="filteredRows.length">
      <div v-for="row in filteredRows" :key="row.key" class="row" @click="openRow(row)">
        <span class="nm">{{ row.name }}</span>
        <span class="chip folder" v-if="row.kind === 'folder'">folder</span>
        <span class="chip browser" v-if="row.kind === 'db'">browser</span>
        <span class="chip github" v-if="row.github">{{ row.github }}</span>
        <span class="chip loadedchip" v-if="row.loaded">loaded</span>
        <span class="meta" v-if="row.count !== undefined">{{ row.count }} catalogues</span>
        <span class="spacer"></span>
        <button
          class="open"
          :class="{ re: row.loaded && row.kind === 'folder' }"
          :title="row.loaded && row.kind === 'folder' ? 'Re-reads files from disk — use after git pull' : undefined"
        >
          {{ row.loaded && row.kind === "folder" ? "↻ Reload" : "Open ▸" }}
        </button>
      </div>
    </div>

    <template v-else-if="!query">
      <div class="empty">
        <h2 class="empty-title">Where is your game data?</h2>
        <p class="empty-sub">NR-Editor edits BattleScribe files. Pick a starting point — you can add more sources later.</p>
        <div class="guide">
          <div class="gcard">
            <div class="t">From GitHub</div>
            <p>Browse community data repos or paste any owner/repo, pick a branch, and import. Send edits back as a pull request when you're done.</p>
            <button class="act" @click="githubOpen = true">Browse repos</button>
          </div>
          <div class="gcard" :class="{ off: !folderSupported }">
            <div class="t">From this computer</div>
            <p>Point at your BattleScribe data folder. Edits save straight back to your files.</p>
            <button class="act" :disabled="!folderSupported" @click="chooseFolder">Choose folder</button>
            <span class="why" v-if="!folderSupported">
              <b>Not available in this browser.</b> Use Chrome, Edge, Brave, or Opera (File System Access API). You can
              still import files below.
            </span>
          </div>
          <div class="gcard">
            <div class="t">Start fresh</div>
            <p>Create a new game system from scratch. It lives in your browser until you give it a folder or repo.</p>
            <CreateSystem class="act" @created="update" />
          </div>
        </div>
        <div class="subline mt-10px">
          …or import individual files (.gst, .cat, .gstz, .catz, .json): <UploadJson @uploaded="uploaded" />
        </div>
      </div>
    </template>
    <div v-else class="subline">No systems match "{{ query }}".</div>
  </div>
  <Loading v-else :progress_msg="progress_msg" :progress_max="progress_max" :progress="progress" />
  <GithubRepoDialog v-model="githubOpen" @uploaded="uploaded" />
</template>

<script lang="ts">
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { BSIDataCatalogue, BSIDataSystem } from "~/assets/shared/battlescribe/bs_types";
import { db } from "~/assets/shared/battlescribe/cataloguesdexie";
import { getFolderFolders, getPath, showOpenDialog } from "~/electron/node_helpers";
import { hasRoot, permissionState, pickFolder, requestPermission, restoreHandles, supported } from "~/electron/web_fs";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorStore";
import { useSettingsStore } from "~/stores/settingsState";
import CreateSystem from "~/components/CreateSystem.vue";
import Loading from "~/components/Loading.vue";
import UploadJson from "~/components/UploadJson.vue";
import SelectFile from "~/components/SelectFile.vue";
import GithubRepoDialog from "~/components/GithubRepoDialog.vue";
import { getDataDbId } from "~/assets/shared/battlescribe/bs_main";

interface SystemRow {
  key: string;
  name: string;
  kind: "folder" | "db";
  path?: string; // folder rows
  id?: string; // db rows
  count?: number;
  github?: string;
}

export default defineComponent({
  components: { CreateSystem, Loading, UploadJson, SelectFile, GithubRepoDialog },
  head() {
    return {
      title: "NR-Editor",
    };
  },
  data() {
    return {
      loading: true,
      needsPermission: false,
      rows: [] as SystemRow[],
      query: "",
      menuOpen: false,
      githubOpen: false,
      progress: 0,
      progress_max: 0,
      progress_msg: "",
    };
  },
  setup() {
    return { cataloguesStore: useCataloguesStore(), store: useEditorStore(), settings: useSettingsStore() };
  },
  computed: {
    isElectron() {
      return Boolean(globalThis.electron);
    },
    fsaSupported() {
      return supported();
    },
    folderSupported() {
      return this.isElectron || this.fsaSupported;
    },
    filteredRows(): Array<SystemRow & { loaded: boolean }> {
      const q = this.query.trim().toLowerCase();
      const rows = q ? this.rows.filter((row) => row.name.toLowerCase().includes(q)) : this.rows;
      return rows.map((row) => ({ ...row, loaded: this.isLoaded(row) }));
    },
  },
  methods: {
    isLoaded(row: SystemRow): boolean {
      if (row.id) {
        return Boolean(this.store.gameSystems[row.id]?.gameSystem);
      }
      const prefix = `${row.path}/`;
      return Object.values(this.store.gameSystems).some((sys) =>
        sys.gameSystem?.gameSystem.fullFilePath?.startsWith(prefix),
      );
    },
    async chooseFolder() {
      try {
        if (this.isElectron) {
          const result = await showOpenDialog({ properties: ["openDirectory"] });
          if (!result?.filePaths?.length) return;
          this.settings.systemsFolder = result.filePaths[0];
        } else {
          const name = await pickFolder();
          if (!name) return;
          this.settings.systemsFolder = name;
        }
        await this.update();
      } catch (e) {
        console.error(e);
      }
    },
    async openRow(row: SystemRow) {
      this.loading = true;
      this.progress_msg = "";
      try {
        if (row.id) {
          await this.store.get_or_load_system(row.id);
          this.settings.activeSystems = [row.id];
          this.$router.push(`/?id=${row.id}`);
          return;
        }
        const loaded = await this.store.load_systems_from_folder(row.path!, async (cur, max, msg) => {
          this.progress = cur;
          this.progress_max = max;
          this.progress_msg = msg ? msg.replaceAll("\\", "/").split("/").slice(-1)[0] : "";
          return new Promise((resolve) => setTimeout(resolve, 1));
        });
        if (loaded?.length) {
          if (!electron) {
            this.settings.activeSystems = loaded;
          }
          this.$router.push(`/?id=${loaded.join(",")}`);
        }
      } finally {
        this.loading = false;
      }
    },
    async grantAccess() {
      if (this.settings.systemsFolder && (await requestPermission(this.settings.systemsFolder))) {
        await this.update();
      }
    },
    async uploaded(files: any[]) {
      console.log("Uploaded", files.length, "files", files);
      const systems = files.filter((o) => o.gameSystem) as BSIDataSystem[];
      const ids = [];
      for (const system of systems) {
        const systemId = system.gameSystem.id;
        ids.push(systemId);
        const dbId = getDataDbId(system);
        this.store.get_system(systemId).setSystem(system);
        if (!electron) {
          db.systems.put({ content: system, id: dbId });
        }
        this.cataloguesStore.updateCatalogue(system.gameSystem);
        this.cataloguesStore.setEdited(dbId, false);
      }

      const catalogues = files.filter((o) => o.catalogue) as BSIDataCatalogue[];
      for (const catalogue of catalogues) {
        const systemId = catalogue.catalogue.gameSystemId;
        this.store.get_system(systemId).setCatalogue(catalogue);
        if (!electron) {
          db.catalogues.put({ content: catalogue, id: getDataDbId(catalogue) });
        }
        this.cataloguesStore.updateCatalogue(catalogue.catalogue);
        this.cataloguesStore.setEdited(getDataDbId(catalogue), false);
      }
      for (const system of systems) {
        const sys = this.store.get_system(system.gameSystem.id);
        this.store.load_system(sys);
      }
      if (!electron) {
        this.settings.activeSystems = ids;
      }
      this.$router.push(`/?id=${ids.join(",")}`);
    },
    async update() {
      try {
        this.needsPermission = false;
        const result = [] as SystemRow[];
        const folder = this.settings.systemsFolder;
        if (electron) {
          const path = folder || `${await getPath("home")}/BattleScribe/data`;
          const folders = await getFolderFolders(path);
          for (const f of folders || []) {
            result.push({ key: f.path, name: f.name, kind: "folder", path: f.path });
          }
        } else if (folder && (await hasRoot(folder))) {
          let granted = (await permissionState(folder)) === "granted";
          if (!granted) {
            // ask right away; browsers may require a user gesture, in which case fall back to the banner
            try {
              granted = await requestPermission(folder);
            } catch {}
            this.needsPermission = !granted;
          }
          if (granted) {
            const folders = await getFolderFolders(folder);
            for (const f of folders || []) {
              result.push({ key: f.path, name: f.name, kind: "folder", path: f.path });
            }
          }
        }
        if (!electron) {
          // systems stored in the browser db, unless already listed via the working folder
          const folderPaths = result.map((o) => `${o.path}/`);
          for (const row of await db.systems.toArray()) {
            const gameSystem = row.content?.gameSystem;
            if (!gameSystem) continue;
            const filePath = gameSystem.fullFilePath || row.path || "";
            if (filePath && folderPaths.some((p) => filePath.startsWith(p))) continue;
            const github = gameSystem.publications?.find((o: any) => o.name?.trim().toLowerCase() === "github");
            const count = await db.catalogues.where({ "content.catalogue.gameSystemId": gameSystem.id }).count();
            result.push({
              key: row.id,
              name: gameSystem.name,
              kind: "db",
              id: row.id,
              count,
              github: github?.shortName?.includes("/") ? github.shortName : undefined,
            });
          }
        }
        this.rows = sortByAscending(result, (o) => o.name);
      } finally {
        this.loading = false;
      }
    },
    closeMenu() {
      this.menuOpen = false;
    },
  },

  async mounted() {
    if (electron && !this.settings.systemsFolder) {
      const home = await getPath("home");
      this.settings.systemsFolder = `${home}/BattleScribe/data`;
    }
    if (!electron) {
      await restoreHandles();
    }
    window.addEventListener("click", this.closeMenu);
    await this.update();
  },
  unmounted() {
    window.removeEventListener("click", this.closeMenu);
  },
});
</script>
<style lang="scss" scoped>
@import "@/shared_components/css/vars.scss";



.roster {
  padding: 22px 26px 40px;
  max-width: 1000px;
  margin: 0 auto;
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.brand {
  font-size: 24px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin: 0;
}
.search {
  flex: 1;
  max-width: 340px;
  padding: 9px 12px;
  font-size: 13.5px;
}
.addwrap {
  margin-left: auto;
  position: relative;
}
.add {
  background: #16294a;
  color: #fff;
  font-weight: 650;
  font-size: 13.5px;
  border: none;
  border-radius: 6px;
  padding: 11px 16px;
  cursor: pointer;
}
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  background: var(--popups_background, #fff);
  border: 1px solid $box_border;
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 200px;
  z-index: 5;
  :deep(.bouton),
  .mitem {
    width: 100%;
    text-align: left;
  }
}
.subline {
  font-size: 12.5px;
  color: gray;
  margin: 4px 0 14px;
  u {
    cursor: pointer;
  }
}
.banner {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  border-radius: 7px;
  padding: 11px 14px;
  margin: 0 0 14px;
  font-size: 13.5px;
  &.warn {
    background: rgba(220, 170, 60, 0.15);
    border: 1px solid rgba(190, 145, 40, 0.45);
  }
  &.info {
    background: rgba(90, 130, 200, 0.12);
    border: 1px solid rgba(90, 130, 200, 0.35);
  }
  .grant {
    margin-left: auto;
    background: #8a6210;
    color: #fff;
    font-weight: 650;
    font-size: 12.5px;
    border: none;
    border-radius: 5px;
    padding: 8px 13px;
    cursor: pointer;
  }
}
.list {
  border: 1px solid $box_border;
  border-radius: 8px;
  overflow: hidden;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid $box_border;
  cursor: pointer;
  font-size: 14.5px;
  &:last-child {
    border-bottom: 0;
  }
  &:hover {
    background: var(--hover-darken-color, rgba(0, 0, 0, 0.08));
  }
  .nm {
    font-weight: 700;
    white-space: nowrap;
  }
  .meta {
    font-size: 12px;
    color: gray;
    white-space: nowrap;
  }
  .spacer {
    flex: 1;
  }
}
.chip {
  font-family: monospace;
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 3px;
  padding: 4px 6px;
  white-space: nowrap;
  &.folder {
    background: rgba(90, 140, 60, 0.18);
    color: #33591f;
  }
  &.browser {
    background: rgba(80, 100, 200, 0.15);
    color: #33418f;
  }
  &.github {
    background: rgba(130, 90, 190, 0.15);
    color: #5b3a86;
    text-transform: none;
  }
  &.loadedchip {
    background: rgba(60, 150, 90, 0.18);
    color: #1d5c38;
  }
}
.open {
  font-weight: 650;
  font-size: 12.5px;
  color: #fff;
  background: #16294a;
  border: none;
  border-radius: 5px;
  padding: 8px 14px;
  white-space: nowrap;
  cursor: pointer;
  &.re {
    background: transparent;
    color: inherit;
    border: 1.5px solid #16294a;
  }
}
.empty-title {
  font-size: 24px;
  font-weight: 800;
  text-transform: uppercase;
  margin: 14px 0 4px;
}
.empty-sub {
  color: gray;
  font-size: 14px;
  margin: 0 0 14px;
  max-width: 58ch;
}
.guide {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(215px, 1fr));
  gap: 14px;
}
.gcard {
  border: 1px solid $box_border;
  border-radius: 8px;
  padding: 18px;
  &.off {
    opacity: 0.75;
    border-style: dashed;
  }
  .t {
    font-weight: 750;
    text-transform: uppercase;
    font-size: 14px;
    margin-bottom: 6px;
  }
  p {
    margin: 0 0 12px;
    font-size: 13px;
    color: gray;
  }
  .act,
  :deep(.bouton) {
    background: #16294a;
    color: #fff;
    font-weight: 650;
    font-size: 12.5px;
    border: none;
    border-radius: 5px;
    padding: 9px 13px;
    cursor: pointer;
  }
  .act:disabled {
    background: #b6bfcc;
    cursor: not-allowed;
  }
  .why {
    font-size: 12px;
    color: #8a6210;
    display: block;
    margin-top: 10px;
    line-height: 1.45;
  }
}

@media (max-width: 640px) {
  .row .meta {
    display: none;
  }
}
</style>

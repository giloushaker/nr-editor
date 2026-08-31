<template>
  <Loading v-if="opening" :progress_msg="progress_msg" :progress_max="progress_max" :progress="progress" />
  <div class="scrollable" v-else>
    <div class="roster">
    <div class="head">
      <h1 class="brand">Systems</h1>
      <span class="searchwrap">
        <input class="search" type="search" v-model="query" placeholder="Search systems…" />
        <button v-if="query" class="clearbt" title="Clear" @click="query = ''">✕</button>
      </span>
      <select class="sortsel" v-model="settings.systemsSort" title="Sort systems">
        <option value="edited">Recently edited</option>
        <option value="opened">Recently opened</option>
        <option value="name">Name</option>
      </select>
      <div class="addwrap">
        <button class="add" @click.stop="menuOpen = !menuOpen">+ Add system ▾</button>
        <div v-if="menuOpen" class="menu" @click.stop>
          <button class="mitem" @click="githubOpen = true; menuOpen = false">Import from GitHub</button>
          <button class="mitem" v-if="folderSupported" @click="chooseFolder(); menuOpen = false">Choose folder</button>
          <UploadJson v-if="!isElectron" class="mitem" @uploaded="uploaded" />
          <CreateSystem class="mitem" @created="update" />
          <SelectFile v-if="isElectron" class="mitem" @uploaded="uploaded" />
        </div>
      </div>
    </div>

    <div class="subline" v-if="folderSupported">
      <template v-if="settings.systemsFolder">
        Working folder: <b>{{ settings.systemsFolder }}</b> · <u @click="chooseFolder">change</u> ·
        <u @click="update()">refresh</u>
      </template>
      <template v-else>
        No working folder — <u @click="chooseFolder">choose your data folder</u> to edit files directly from disk.
      </template>
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

    <Loading
      v-if="loading"
      class="listload"
      :progress_msg="progress_msg"
      :progress_max="progress_max"
      :progress="progress"
    />
    <template v-else>
    <div class="list" v-if="filteredRows.length">
      <div v-for="row in filteredRows" :key="row.key" class="row" @click="openRow(row)">
        <span class="nm">{{ row.name }}</span>
        <span class="chip folder" v-if="row.kind === 'folder'">folder</span>
        <span class="chip browser" v-if="row.kind === 'db'">browser</span>
        <span class="chip github" v-if="row.github">{{ row.github }}</span>
        <span class="spacer"></span>
        <span class="meta">{{ rowTime(row) }}</span>
        <button
          class="open"
          :class="{ re: row.loaded }"
          :title="row.loaded ? (row.kind === 'folder' ? 'Re-reads files from disk — use after git pull' : 'Re-reads the stored data') : undefined"
        >
          {{ row.loaded ? "↻ Reload" : "Open ▸" }}
        </button>
      </div>
    </div>

    <template v-else-if="!query">
      <div class="empty">
        <h2 class="empty-title">Where is your game data?</h2>
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
            <button class="act" @click="($refs.createSystem as any)?.click()">Create System</button>
            <span class="hiddenTrigger"><CreateSystem ref="createSystem" @created="update" /></span>
          </div>
        </div>
        <div class="subline mt-10px" v-if="!isElectron">
          …or import individual files (.gst, .cat, .gstz, .catz, .json): <UploadJson @uploaded="uploaded" />
        </div>
      </div>
    </template>
    <div v-else class="subline">No systems match "{{ query }}".</div>
    </template>
    </div>
  </div>
  <GithubRepoDialog v-model="githubOpen" @uploaded="uploaded" />
</template>

<script lang="ts">
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import type { BSIDataCatalogue, BSIDataSystem } from "~/assets/shared/battlescribe/bs_types";
import { db } from "~/assets/shared/battlescribe/cataloguesdexie";
import { createFolder, getFolderFolders, getFolderMtime, getPath, isDirectory, showOpenDialog } from "~/electron/node_helpers";
import { hasRoot, permissionState, pickFolder, requestPermission, restoreHandles, supported } from "~/electron/web_fs";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorStore";
import { useSettingsStore } from "~/stores/settingsState";
import CreateSystem from "~/components/CreateSystem.vue";
import Loading from "~/components/Loading.vue";
import UploadJson from "~/components/UploadJson.vue";
import SelectFile from "~/components/SelectFile.vue";
import GithubRepoDialog from "~/components/GithubRepoDialog.vue";
import { getDataDbId, getDataObject } from "~/assets/shared/battlescribe/bs_main";

interface SystemRow {
  key: string;
  name: string;
  kind: "folder" | "db";
  path?: string; // folder rows
  id?: string; // db rows
  metaId?: string; // folder rows: system id recovered from the db copy, used for recency/meta only
  github?: string;
  lastModified?: number; // folder rows: newest file mtime on disk
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
      // Opening a system navigates away, so it takes over the page; `loading` is only the
      // list refreshing in place, which leaves the header and search usable.
      opening: false,
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
    filteredRows(): Array<SystemRow & { loaded: boolean; lastOpened?: number; lastEdited?: number }> {
      const q = this.query.trim().toLowerCase();
      const rows = q ? this.rows.filter((row) => row.name.toLowerCase().includes(q)) : this.rows;
      const decorated = rows.map((row) => {
        const infoId = row.id || row.metaId;
        const info = infoId
          ? this.cataloguesStore.systemInfo[infoId]
          : Object.values(this.cataloguesStore.systemInfo).find((o) => o.folderPath === row.path);
        return { ...row, loaded: this.isLoaded(row), lastOpened: info?.lastOpened, lastEdited: info?.lastEdited };
      });
      // loaded systems pinned on top (for reloading), then the chosen sort, then alphabetical
      const editedOf = (r: (typeof decorated)[number]) => r.lastModified || r.lastEdited || r.lastOpened || 0;
      const sorters: Record<string, (a: any, b: any) => number> = {
        edited: (a, b) => editedOf(b) - editedOf(a),
        opened: (a, b) => (b.lastOpened || 0) - (a.lastOpened || 0),
        name: () => 0,
      };
      const sorter = sorters[this.settings.systemsSort] || sorters.edited;
      return decorated.sort(
        (a, b) => Number(b.loaded) - Number(a.loaded) || sorter(a, b) || a.name.localeCompare(b.name),
      );
    },
  },
  methods: {
    rowTime(row: SystemRow & { lastOpened?: number; lastEdited?: number }): string {
      const edited = row.lastModified || row.lastEdited;
      if (edited) return this.ago(edited);
      if (row.lastOpened) return `opened ${this.ago(row.lastOpened)}`;
      return "";
    },
    ago(ts: number): string {
      const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
      const s = (Date.now() - ts) / 1000;
      if (s < 90) return "just now";
      if (s < 3600) return plural(Math.round(s / 60), "minute");
      if (s < 129600) return plural(Math.round(s / 3600), "hour");
      const days = Math.round(s / 86400);
      if (days <= 70) return plural(days, "day");
      const months = Math.round(days / 30);
      if (months <= 18) return plural(months, "month");
      return plural(Math.round(days / 365), "year");
    },
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
      this.opening = true;
      this.progress_msg = "";
      try {
        if (row.kind === "db" && row.id) {
          if (this.isLoaded(row)) {
            await this.store.load_system_from_db(row.id);
          } else {
            await this.store.get_or_load_system(row.id);
          }
          this.settings.activeSystems = [row.id];
          this.cataloguesStore.touchOpened(row.id);
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
          for (const id of loaded) {
            this.cataloguesStore.touchOpened(id, row.path);
          }
          this.$router.push(`/?id=${loaded.join(",")}`);
        }
      } finally {
        this.opening = false;
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
      if (electron) {
        // write imported files to disk (github imports carry working-folder paths)
        for (const file of files) {
          if (getDataObject(file).fullFilePath) {
            this.store.saveCatalogue(file);
          }
        }
      } else {
        this.settings.activeSystems = ids;
      }
      for (const id of ids) {
        this.cataloguesStore.touchOpened(id);
      }
      this.$router.push(`/?id=${ids.join(",")}`);
    },
    async update() {
      try {
        this.needsPermission = false;
        const result = [] as SystemRow[];
        const folder = this.settings.systemsFolder;
        if (electron && folder) {
          const folders = await getFolderFolders(folder);
          for (const f of folders || []) {
            // normalize: settings paths may carry backslashes, loaded fullFilePaths never do
            const path = f.path.replaceAll("\\", "/");
            result.push({ key: path, name: f.name, kind: "folder", path });
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

        const dbSystems = await db.systems.toArray();
        const githubOf = (gameSystem: any) => {
          const pub = gameSystem.publications?.find((o: any) => o.name?.trim().toLowerCase() === "github");
          return pub?.shortName?.includes("/") ? pub.shortName : undefined;
        };
        // decorate folder rows from their db copy (repo chip, counts, recency) — works on both platforms
        for (const folderRow of result) {
          const prefix = `${folderRow.path}/`;
          const dbRow = dbSystems.find((row) => {
            const filePath = row.content?.gameSystem?.fullFilePath || row.path || "";
            return filePath.startsWith(prefix) || filePath.replace(/\\/g, "/").startsWith(prefix);
          });
          const gameSystem = dbRow?.content?.gameSystem;
          if (!gameSystem) continue;
          folderRow.metaId = gameSystem.id;
          folderRow.github = githubOf(gameSystem);
        }
        if (!electron) {
          // systems stored only in the browser db (not present in the working folder)
          const folderPaths = result.map((o) => `${o.path}/`);
          for (const row of dbSystems) {
            const gameSystem = row.content?.gameSystem;
            if (!gameSystem) continue;
            const filePath = gameSystem.fullFilePath || row.path || "";
            if (filePath && folderPaths.some((p) => filePath.startsWith(p))) continue;
            result.push({
              key: row.id,
              name: gameSystem.name,
              kind: "db",
              id: row.id,
              github: githubOf(gameSystem),
            });
          }
        }
        // gather disk mtimes before rendering so the sort order doesn't shuffle after paint
        await Promise.all(
          result
            .filter((row) => row.kind === "folder" && row.path)
            .map(async (row) => {
              const mtime = await getFolderMtime(row.path!);
              if (mtime) row.lastModified = mtime;
            }),
        );
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
    try {
      if (electron && (!this.settings.systemsFolder || !(await isDirectory(this.settings.systemsFolder)))) {
        // unset or pointing at a folder that no longer exists: keep the BattleScribe
        // folder only if it actually exists, otherwise use our own
        const home = await getPath("home");
        const battlescribe = `${home}/BattleScribe/data`;
        if (await isDirectory(battlescribe)) {
          this.settings.systemsFolder = battlescribe;
        } else {
          const documents = await getPath("documents");
          this.settings.systemsFolder = `${documents}/NewRecruit/data`;
          await createFolder(this.settings.systemsFolder);
        }
      }
      if (!electron) {
        await restoreHandles();
      }
    } catch (e) {
      console.error("Failed to initialize the working folder", e);
    }
    window.addEventListener("click", this.closeMenu);
    await this.update();
  },
  // keepalive: refresh the list when navigating back to this page
  activated() {
    if (!this.loading) {
      this.update();
    }
  },
  unmounted() {
    window.removeEventListener("click", this.closeMenu);
  },
});
</script>
<style lang="scss" scoped>
@use "@/shared_components/css/vars.scss" as *;



.roster {
  padding: 18px 26px 100px;
  max-width: 720px;
  margin: 0 auto;
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.brand {
  font-size: 18px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 0;
}
.searchwrap {
  position: relative;
  display: inline-flex;
  flex: 1;
  max-width: 340px;
}
.search {
  width: 100%;
  padding: 6px 26px 6px 10px;
  font-size: 13px;
}
.clearbt {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.55;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  &:hover {
    opacity: 1;
  }
}
.sortsel {
  padding: 5px 8px;
  font-size: 12.5px;
}
.addwrap {
  margin-left: auto;
  position: relative;
}
.add {
  background: #16294a;
  color: #fff;
  font-weight: 400;
  font-size: 13px;
  border: none;
  border-radius: 6px;
  padding: 8px 13px;
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
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 200px;
  z-index: 5;
  // flat menu entries: strip the button chrome from .mitem and embedded .bouton alike
  .mitem,
  :deep(.bouton) {
    width: 100%;
    text-align: left !important;
    font-weight: 400;
    font-size: 13px;
    border: none !important;
    border-radius: 4px;
    background: transparent;
    background-image: none !important;
    box-shadow: none;
    color: inherit;
    padding: 8px 10px;
    cursor: pointer;
    &:hover {
      background: var(--hover-darken-color, rgba(0, 0, 0, 0.08));
    }
  }
}
.subline {
  font-size: 13px;
  color: gray;
  margin: 4px 0 14px;
  u {
    cursor: pointer;
  }
  :deep(.bouton) {
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 400;
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
    font-weight: 400;
    font-size: 12.5px;
    border: none;
    border-radius: 5px;
    padding: 8px 13px;
    cursor: pointer;
  }
}
/* Loading's root is height:100%, which resolves to nothing inside the auto-height roster */
.listload {
  min-height: 240px;
}

.list {
  border: 1px solid $box_border;
  border-radius: 8px;
  overflow: hidden;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-bottom: 1px solid $box_border;
  cursor: pointer;
  font-size: 14oldpx;
  &:last-child {
    border-bottom: 0;
  }
  &:hover {
    background: var(--hover-darken-color, rgba(0, 0, 0, 0.08));
  }
  .nm {
    white-space: nowrap;
  }
  .meta {
    font-size: 11.5px;
    color: gray;
    white-space: nowrap;
  }
  .spacer {
    flex: 1;
  }
}
.chip {
  font-family: monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 3px;
  padding: 2px 5px;
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
}
.open {
  font-weight: 400;
  font-size: 12px;
  color: #fff;
  background: #16294a;
  border: none;
  border-radius: 5px;
  padding: 4px 10px;
  white-space: nowrap;
  cursor: pointer;
  &.re {
    background: transparent;
    color: inherit;
    border: 1px solid currentColor;
  }
}

.empty-title {
  font-size: 20px;
  font-weight: 700;
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
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  &.off {
    opacity: 0.75;
    border-style: dashed;
  }
  .t {
    font-weight: 650;
    font-size: 14px;
    margin-bottom: 6px;
  }
  p {
    margin: 0 0 12px;
    font-size: 13px;
    color: gray;
    flex: 1;
  }
  .act,
  :deep(.bouton) {
    background: #16294a;
    color: #fff !important;
    font-weight: 400;
    font-size: 12.5px;
    border: none !important;
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
  .hiddenTrigger {
    display: none;
  }
}

@media (max-width: 640px) {
  .row .meta {
    display: none;
  }
}
</style>
<style lang="scss">
/* unscoped: the chip colors above are tuned for a light background.
   (:global() inside the scoped block miscompiles to a bare html.dark rule) */
html.dark .roster .chip.folder {
  background: rgba(110, 170, 80, 0.28);
  color: #a9d88d;
}
html.dark .roster .chip.browser {
  background: rgba(110, 135, 240, 0.28);
  color: #b3c1f7;
}
html.dark .roster .chip.github {
  background: rgba(165, 125, 225, 0.28);
  color: #cdb6f0;
}
</style>

<template>
  <div class="page">
    <!-- Guarded on $router.currentRoute, not $route: see search/[id].vue -->
    <Teleport to="#titlebar-content" v-if="system && $router.currentRoute.value.name === 'icons-id'">
      <span class="ml-10px">
        {{ system.gameSystem?.gameSystem?.name || "System" }}
        <span class="crumb-sep">&rsaquo;</span> Icons
      </span>
    </Teleport>

    <p v-if="!system" class="gray">Loading…</p>
    <p v-else-if="access === 'missing'" class="error">
      Icons are files beside the .gst, so this system has to be opened from its folder. Open the folder from the
      Systems page, then come back.
    </p>
    <p v-else-if="access === 'prompt'">
      The editor needs access to <code>{{ folder }}</code> again to read and write its icons.
      <button class="bouton" @click="grant">Grant access</button>
    </p>
    <template v-else>
      <p class="gray">
        Files go in <code>icons/</code> beside the .gst, named by id, which New Recruit reads on install and while the
        game is selected. Nothing is written to the data files.
      </p>
      <p v-if="state.error" class="error">{{ state.error }}</p>

      <div class="toolbar">
        <input v-model="filter" type="search" placeholder="Filter by name" />
        <label class="unsetOnly"><input v-model="unsetOnly" type="checkbox" /> Unset only</label>
        <span class="count">{{ selectedRows.length }} selected</span>
        <button class="bouton" :disabled="busy || !selectedRows.length" @click="picking = true">Set icon</button>
        <button class="bouton" :disabled="busy || !removableSelected.length" @click="remove">Remove icon</button>
        <button class="bouton" :disabled="!selectedRows.length" @click="selected = {}">Clear</button>
        <button class="bouton" :disabled="busy" title="Read icons/ again" @click="reload">Reload</button>
      </div>

      <details v-for="section of sections" :key="section.title" open class="section">
        <summary class="sectionTitle">
          {{ section.title }}
          <span class="gray">{{ section.setCount }} set of {{ section.rows.length }}</span>
        </summary>
        <div class="cards">
          <label
            v-for="row of section.shown"
            :key="rowId(row)"
            class="card"
            :class="{ picked: selected[rowId(row)] }"
            :title="rowTitle(row)"
          >
            <input v-model="selected[rowId(row)]" type="checkbox" />
            <img v-if="preview(row)" class="preview" :src="preview(row)!" alt="" />
            <span v-else class="preview none" />
            <span class="label">{{ row.label }}</span>
          </label>
        </div>
      </details>
      <UtilIconPicker v-if="picking" :state="state" :targets="selectedRows" @close="picking = false" @done="selected = {}" />
    </template>
  </div>
</template>

<script lang="ts">
import { collectIconChoices } from "~/assets/shared/battlescribe/icons";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import type { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import {
  factionSeparator,
  hasRemovableFile,
  parentFactionName,
  refreshIcons,
  removeIcons,
  systemFiles,
  systemIcons,
  targetIconPath,
  iconFolder,
  grantFolder,
  type IconTarget,
  type SystemIcons,
} from "~/assets/editor/system_icons";
import { useEditorStore } from "~/stores/editorStore";

/** The admin icon editor of New Recruit (SystemIconsEditor.vue), writing files into the system's folder instead. */
export default defineComponent({
  setup() {
    return { store: useEditorStore() };
  },
  data() {
    return {
      system: null as GameSystemFiles | null,
      state: null as SystemIcons | null,
      folder: "",
      access: "" as "" | "granted" | "prompt" | "missing",
      separator: undefined as string | undefined,
      selected: {} as Record<string, boolean>,
      filter: "",
      unsetOnly: false,
      busy: false,
      picking: false,
    };
  },
  async created() {
    const system = await this.store.get_or_load_system((this.$route.params as { id: string }).id);
    const { folder, access } = await iconFolder(system);
    this.folder = folder ?? "";
    this.access = access;
    if (folder && access === "granted") await this.open();
    this.system = system;
  },
  // Kept alive: a file added by hand while away shows on return
  activated() {
    if (this.state?.loaded) void refreshIcons(this.state);
  },
  computed: {
    sections(): Array<{ title: string; rows: IconTarget[]; shown: IconTarget[]; setCount: number }> {
      const files = systemFiles(this.system!);
      const gst = getDataObject(this.system!.gameSystem!);
      const books = files.filter((f) => f !== gst && !f.library);
      const catalogues = books.map((b) => ({ kind: "army", label: b.name.trim(), keys: [b.id, b.name], icon: b.icon }));
      const parents = [...new Set(books.map((b) => parentFactionName(b.name, this.separator)).filter((p): p is string => !!p))];
      const { categories, forces } = collectIconChoices(files);
      const raw = [
        {
          title: "Game",
          rows: [
            { kind: "system", label: "Game icon", keys: [gst.id, "system"], icon: gst.icon },
            { kind: "weapon", label: "Weapon icon", keys: ["weapon"] },
          ],
        },
        { title: "Catalogues", rows: catalogues.sort((a, b) => a.label.localeCompare(b.label)) },
        // No id to name these by: NR groups catalogues by the part of their name before factionSeparator
        ...(parents.length ? [{ title: "Parent factions", rows: parents.sort().map((p) => ({ kind: "army", label: p, keys: [p] })) }] : []),
        { title: "Primary categories", rows: categories.map((c) => ({ kind: "category", label: c.name, keys: [c.id, c.name], icon: this.ownIcon(c.id) })) },
        { title: "Force entries", rows: forces.map((f) => ({ kind: "force", label: f.name, keys: [f.id, f.name], icon: this.ownIcon(f.id) })) },
      ];
      const needle = this.filter.trim().toLowerCase();
      return raw.map((s) => ({
        ...s,
        shown: s.rows.filter((r) => (!needle || r.label.toLowerCase().includes(needle)) && (!this.unsetOnly || !this.preview(r))),
        setCount: s.rows.filter((r) => this.preview(r)).length,
      }));
    },
    allRows(): IconTarget[] {
      return this.sections.flatMap((s) => s.rows);
    },
    selectedRows(): IconTarget[] {
      return this.allRows.filter((r) => this.selected[this.rowId(r)]);
    },
    removableSelected(): IconTarget[] {
      return this.selectedRows.filter((r) => hasRemovableFile(this.state!, r));
    },
    /** `icon` attributes by node id, from repos NR owns; the editor shows them but never writes them */
    ownIcons(): Map<string, string> {
      const icons = new Map<string, string>();
      const walk = (node: any) => {
        for (const key of ["categoryEntries", "forceEntries", "forceEntryLinks"]) for (const item of node?.[key] ?? []) {
          if (item.icon) icons.set(item.id, item.icon);
          walk(item);
        }
      };
      for (const file of systemFiles(this.system!)) walk(file);
      return icons;
    },
  },
  methods: {
    async open() {
      this.separator = await factionSeparator(this.folder);
      this.state = systemIcons(this.folder);
    },
    async grant() {
      if (!(await grantFolder(this.folder))) return;
      this.access = "granted";
      await this.open();
    },
    ownIcon(id: string) {
      return this.ownIcons.get(id);
    },
    rowId(row: IconTarget): string {
      return `${row.kind}\n${row.keys.join("\n")}`;
    },
    rowTitle(row: IconTarget): string {
      const path = targetIconPath(this.state!, row);
      if (!path) return row.label;
      return row.icon ? `${row.label}\n${path} (icon attribute; Remove leaves it)` : `${row.label}\n${path}`;
    },
    preview(row: IconTarget): string | null {
      const path = targetIconPath(this.state!, row);
      return (path && this.state!.urls[path.replace(/^\.?\//, "")]) || null;
    },
    async reload() {
      this.busy = true;
      await refreshIcons(this.state!);
      this.busy = false;
    },
    async remove() {
      const rows = this.removableSelected;
      if (!confirm(`Delete the icon files of ${rows.length} ${rows.length === 1 ? "node" : "nodes"} from icons/?`)) return;
      this.busy = true;
      try {
        await removeIcons(this.state!, rows);
        this.selected = {};
      } catch (e) {
        this.state!.error = `Could not delete: ${(e as Error)?.message ?? e}`;
      } finally {
        this.busy = false;
      }
    },
  },
});
</script>

<style scoped lang="scss">
.page {
  padding: 8px 16px;
  max-width: 1100px;
  overflow: auto;
  height: 100%;
}
.error {
  color: var(--nr-danger);
}
.bouton {
  flex: none;
  width: auto;
  min-width: 0;
  padding: 2px 12px;
  &:disabled {
    opacity: 0.4;
  }
}
// Stays reachable while scrolling a long section: the actions apply to the selection
.toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  background: var(--nr-bg);
  input[type="search"] {
    flex: 1;
    min-width: 160px;
  }
  .count,
  .unsetOnly {
    white-space: nowrap;
  }
  .unsetOnly {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }
}
.section {
  margin-top: 8px;
}
.sectionTitle {
  font-weight: bold;
  cursor: pointer;
  .gray {
    font-weight: normal;
    margin-left: 6px;
  }
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 6px;
  padding: 6px 0;
}
.card {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid var(--nr-line);
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background: var(--nr-fill);
  }
  &.picked {
    border-color: var(--nr-accent);
    box-shadow: inset 0 0 0 1px var(--nr-accent);
  }
  input {
    flex: none;
    margin: 0;
  }
}
.preview {
  width: 28px;
  height: 28px;
  flex: none;
  object-fit: contain;
  &.none {
    border: 1px dashed var(--nr-line);
    border-radius: 3px;
  }
}
// Two lines: names in a game often share a long prefix, so one truncated line hides the part that differs
.label {
  min-width: 0;
  font-size: 0.85em;
  line-height: 1.2;
  overflow: hidden;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>

<template>
  <div class="page">
    <Teleport to="#titlebar-content" v-if="system && pageActive && $router.currentRoute.value.name === 'patch-id'">
      <span class="ml-10px">
        {{ system.gameSystem?.gameSystem?.name || "System" }}
        <span class="crumb-sep">&rsaquo;</span> Patch review
      </span>
      <button v-if="store.unsavedCount" class="bouton save ml-10px" title="Saves every file with unsaved edits, approvals included" @click="saveAll">
        Save All
      </button>
    </Teleport>

    <Loading v-if="loading" :progress="progress" :progress_max="progressMax" :progress_msg="progressMsg" />
    <template v-else>
      <div class="bar">
        <button class="bouton" :disabled="!canPickFolder" :title="folderTitle" @click="openFolder">Open patch folder…</button>
        <button class="bouton" title="Pick patch.json and its patch.*.json parts" @click="openFiles">Open patch files…</button>
        <input ref="fileInput" class="hidden" type="file" multiple accept=".json,application/json" @change="filesPicked" />
        <span v-if="files.length" class="muted small">{{ files.join(", ") }}</span>
        <span class="spacer" />
        <template v-if="files.length">
          <span v-if="reviewError" class="warn small">{{ reviewError }}</span>
          <span v-else-if="reviewPath" class="muted small" :title="reviewPath">Decisions saved to {{ REVIEW_FILE }}</span>
          <span v-else class="muted small">This browser cannot write next to picked files.</span>
          <button v-if="!reviewPath || reviewError" class="bouton" @click="downloadReview">Download {{ REVIEW_FILE }}</button>
        </template>
      </div>

      <div v-if="error" class="issue">{{ error }}</div>

      <div v-if="!files.length" class="empty">
        <p>
          Review the patch New Recruit applies on top of this system's data: the <code>patch.json</code> and <code>patch.*.json</code>
          files in its <code>data/settings/&lt;system&gt;/</code> folder.
        </p>
        <p class="muted">
          Approving an entry makes the same change here as an ordinary unsaved edit: undo it with Ctrl+Z, save it like any other.
          Rejecting only records the decision. Decisions go to <code>{{ REVIEW_FILE }}</code> next to the patch, so you can resume later.
        </p>
      </div>

      <template v-else>
        <div class="counts">
          <span
            v-for="f in FILTERS"
            :key="f.id"
            class="chip"
            :class="[f.id, { active: filter === f.id }]"
            @click="filter = f.id"
          >
            {{ f.label }} <b>{{ counts[f.id] }}</b>
          </span>
          <input v-model="text" class="find" type="search" placeholder="Filter by name, note or id…" />
        </div>

        <div class="split">
          <div class="list">
            <div v-if="!grouped.length" class="muted pad">Nothing matches this filter.</div>
            <template v-for="file in grouped" :key="file.name">
              <div class="file-head">
                <img class="typeIcon" src="assets/bsicons/catalogue.png" />
                <span class="grow">{{ file.name }}</span>
                <span class="muted">{{ file.count }}</span>
                <button class="inputstyle small" :disabled="busy" title="Approve every pending entry of this file that applies" @click.stop="bulk(file.rows, 'approved')">
                  Approve pending
                </button>
                <button class="inputstyle small" :disabled="busy" title="Reject every pending entry of this file" @click.stop="bulk(file.rows, 'rejected')">Reject pending</button>
              </div>
              <template v-for="group in file.groups" :key="group.name">
                <div class="group-head">
                  <img v-if="group.icon" class="typeIcon" :src="`assets/bsicons/${group.icon}.png`" />
                  <span class="grow">{{ group.name }}</span>
                  <span class="muted">{{ group.rows.length }}</span>
                  <template v-if="group.rows.length > 1">
                    <button class="inputstyle small" :disabled="busy" @click.stop="bulk(group.rows, 'approved')">Approve pending</button>
                    <button class="inputstyle small" :disabled="busy" @click.stop="bulk(group.rows, 'rejected')">Reject pending</button>
                  </template>
                </div>
                <div
                  v-for="row in group.rows"
                  :key="row.info.key"
                  class="row"
                  :class="{ selected: row.info.key === selectedKey }"
                  @click="selectedKey = row.info.key"
                >
                  <span class="dot" :class="row.status" :title="STATUS_LABELS[row.status]" />
                  <span class="mark" :class="decisionOf(row)?.status" :title="markTitle(row)">{{ markOf(row) }}</span>
                  <span class="label">
                    <img v-if="iconOf(row)" class="typeIcon" :src="`assets/bsicons/${iconOf(row)}.png`" />{{ labelOf(row) }}
                    <span v-if="row.targets.length > 1" class="muted"> ×{{ row.targets.length }}</span>
                  </span>
                  <span class="ops muted">{{ row.info.ops.join(" ") }}</span>
                  <span class="note muted">{{ row.info.note }}</span>
                </div>
              </template>
            </template>
          </div>

          <div class="detail-pane">
            <PatchEntryDetail
              v-if="selectedRow"
              :key="selectedRow.info.key"
              :row="selectedRow"
              :decision="decisionOf(selectedRow)"
              :changed-since-decision="changedSinceDecision(selectedRow)"
              :resolve="resolve"
              @decide="decideSelected"
              @clear="clearSelected"
              @goto="goto"
            />
            <div v-else class="muted pad">Select an entry to see what it changes.</div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script lang="ts">
import { markRaw } from "vue";
import { getEntryPathInfo, getName } from "~/assets/editor/bs_editor";
import {
  REVIEW_FILE,
  STATUS_LABELS,
  applyChanges,
  entryStatus,
  findTargets,
  listEntries,
  parseReview,
  previewTarget,
  serializeReview,
  type Decision,
  type EditPath,
  type Json,
  type PatchEntryInfo,
  type ReviewFile,
  type ReviewRecord,
  type ReviewRow,
} from "~/assets/editor/patch_review";
import { isPatchFile } from "~/assets/editor/patch_files";
import type { PatchIndex } from "~/assets/shared/battlescribe/bs_helpers";
import { arrayKeys, forEachObjectWhitelist2, type Base } from "~/assets/shared/battlescribe/bs_main";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import PatchEntryDetail from "~/components/patch/PatchEntryDetail.vue";
import { closeWindow, dirname, listFolder, readFile, showMessageBox, showOpenDialog, writeFile } from "~/electron/node_helpers";
import { pickFolder, supported } from "~/electron/web_fs";
import { useEditorStore } from "~/stores/editorStore";

type Filter = "all" | "pending" | "approved" | "rejected" | "stale" | "in-data" | "no-match";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "stale", label: "Stale" },
  { id: "in-data", label: "Already in data" },
  { id: "no-match", label: "No match" },
];

const NO_MATCH_FILE = "Matches nothing in this system";

interface Group {
  name: string;
  icon?: string;
  rows: ReviewRow[];
}
interface FileGroup {
  name: string;
  count: number;
  rows: ReviewRow[];
  groups: Group[];
}

export default defineComponent({
  components: { PatchEntryDetail },
  setup() {
    return { store: useEditorStore() };
  },
  data() {
    return {
      FILTERS,
      REVIEW_FILE,
      STATUS_LABELS,
      system: null as GameSystemFiles | null,
      systemId: "",
      loading: true,
      progress: 0,
      progressMax: 0,
      progressMsg: "",
      pageActive: true,
      busy: false,
      error: "",
      files: [] as string[],
      merged: {} as PatchIndex,
      entries: [] as PatchEntryInfo[],
      rows: [] as ReviewRow[],
      review: { version: 1, decisions: {} } as ReviewFile,
      reviewPath: "",
      reviewError: "",
      selectedKey: "",
      filter: "all" as Filter,
      text: "",
    };
  },
  async created() {
    this.systemId = (this.$route.params as { id: string }).id;
    try {
      const system = await this.store.get_or_load_system(this.systemId);
      // Every catalogue has to be loaded: an entry's target can be in any file.
      await system.loadAll(async (current, max, msg) => {
        this.progress = current;
        this.progressMax = max;
        this.progressMsg = msg ?? "";
      });
      this.system = system;
    } catch (e) {
      this.error = `Could not load the system: ${(e as Error).message}`;
      console.error(e);
    } finally {
      this.loading = false;
    }
  },
  mounted() {
    window.addEventListener("beforeunload", this.beforeUnload);
  },
  unmounted() {
    window.removeEventListener("beforeunload", this.beforeUnload);
  },
  activated() {
    this.pageActive = true;
    window.addEventListener("beforeunload", this.beforeUnload);
    // Edits or undos made in the editor meanwhile change what each entry still has to do.
    if (this.entries.length) this.compute();
  },
  deactivated() {
    this.pageActive = false;
    window.removeEventListener("beforeunload", this.beforeUnload);
  },
  computed: {
    canPickFolder(): boolean {
      return Boolean(globalThis.electron) || supported();
    },
    folderTitle(): string {
      return this.canPickFolder
        ? "Pick the folder holding patch.json; decisions are saved next to it"
        : "Opening a folder needs Chrome, Edge, Brave or Opera, or the desktop app. Open the files instead.";
    },
    counts(): Record<Filter, number> {
      const counts = { all: 0, pending: 0, approved: 0, rejected: 0, stale: 0, "in-data": 0, "no-match": 0 } as Record<Filter, number>;
      for (const row of this.rows) for (const f of FILTERS) if (this.passes(row, f.id)) counts[f.id]++;
      return counts;
    },
    visible(): ReviewRow[] {
      const text = this.text.trim().toLowerCase();
      return this.rows.filter((row) => this.passes(row, this.filter) && (!text || this.searchText(row).includes(text)));
    },
    grouped(): FileGroup[] {
      const files = new Map<string, FileGroup>();
      for (const row of this.visible) {
        const name = row.file || NO_MATCH_FILE;
        let file = files.get(name);
        if (!file) files.set(name, (file = { name, count: 0, rows: [], groups: [] }));
        file.count++;
        file.rows.push(row);
        let group = file.groups.find((g) => g.name === row.group);
        if (!group) file.groups.push((group = { name: row.group, icon: this.groupIcon(row), rows: [] }));
        group.rows.push(row);
      }
      // Dead entries last: they are not about anything a file holds.
      return [...files.values()].sort((a, b) => Number(a.name === NO_MATCH_FILE) - Number(b.name === NO_MATCH_FILE) || a.name.localeCompare(b.name));
    },
    selectedRow(): ReviewRow | undefined {
      return this.rows.find((r) => r.info.key === this.selectedKey);
    },
  },
  methods: {
    resolve(id: string): Base | undefined {
      return this.system?.findOptionById(id);
    },
    live(node: Json): EditorBase {
      return node as unknown as EditorBase;
    },
    /** The decision still standing for this row; one made on an older version of the entry does not count. */
    decisionOf(row: ReviewRow): ReviewRecord | undefined {
      const record = this.review.decisions[row.info.key];
      return record?.fingerprint === row.info.fingerprint ? record : undefined;
    },
    changedSinceDecision(row: ReviewRow): boolean {
      const record = this.review.decisions[row.info.key];
      return Boolean(record && record.fingerprint !== row.info.fingerprint);
    },
    passes(row: ReviewRow, filter: Filter): boolean {
      const decision = this.decisionOf(row)?.status;
      switch (filter) {
        case "all":
          return true;
        case "pending":
          return !decision;
        case "approved":
        case "rejected":
          return decision === filter;
        default:
          return row.status === filter;
      }
    },
    searchText(row: ReviewRow): string {
      return [row.info.key, row.info.note, row.group, this.labelOf(row)].join(" ").toLowerCase();
    },
    markOf(row: ReviewRow): string {
      const decision = this.decisionOf(row)?.status;
      if (decision === "approved") return row.status === "applies" ? "✓!" : "✓";
      if (decision === "rejected") return "✕";
      return this.changedSinceDecision(row) ? "?" : "";
    },
    markTitle(row: ReviewRow): string {
      const decision = this.decisionOf(row)?.status;
      if (decision === "approved" && row.status === "applies") return "Approved, but the data does not hold it (undone, or reloaded without saving?)";
      if (decision) return decision;
      return this.changedSinceDecision(row) ? "The entry changed since it was decided" : "pending";
    },
    /** Top-level entry holding the node: the unit a data author thinks in. */
    rootOf(node: EditorBase): EditorBase {
      let current = node;
      while (current.parent && !current.parent.isCatalogue()) current = current.parent as EditorBase;
      return current;
    },
    groupIcon(row: ReviewRow): string | undefined {
      const node = row.targets[0]?.node;
      return node ? this.rootOf(this.live(node)).editorTypeName : undefined;
    },
    iconOf(row: ReviewRow): string | undefined {
      const node = row.targets[0]?.node;
      return node ? this.live(node).editorTypeName : undefined;
    },
    /** The target's path below its group, so rows under "Captain" read "Leading" rather than repeating it. */
    labelOf(row: ReviewRow): string {
      const node = row.targets[0]?.node;
      if (!node) return `${row.info.field} = ${row.info.value}`;
      const path = getEntryPathInfo(this.live(node)).slice(2);
      return path.length ? path.map((p) => p.display || p.name || p.type).join(" › ") : getName(this.live(node));
    },
    compute() {
      const system = this.system;
      if (!system) return;
      const catalogues = system.getAllLoadedCatalogues();
      const targets = findTargets((cb) => {
        for (const catalogue of catalogues) {
          cb(catalogue as unknown as Json);
          forEachObjectWhitelist2(catalogue, (node) => cb(node as unknown as Json), arrayKeys);
        }
      }, this.merged);
      this.rows = this.entries.map((info) => {
        const approved = this.decisionOf({ info } as ReviewRow)?.status === "approved";
        const previews = (targets.get(info.key) ?? []).map((node) => previewTarget(node, this.merged, info, approved));
        const first = previews[0] && this.live(previews[0].node);
        return markRaw({
          info,
          targets: previews,
          status: entryStatus(previews),
          file: first?.getCatalogue()?.getName() ?? "",
          group: first ? getName(this.rootOf(first)) : "Dead entries",
        });
      });
    },
    load(parts: Array<{ name: string; text: string }>, reviewPath: string) {
      this.error = "";
      const patches: Array<{ name: string; patch: PatchIndex }> = [];
      let review: ReviewFile = { version: 1, decisions: {} };
      for (const part of parts) {
        try {
          if (part.name === REVIEW_FILE) review = parseReview(part.text);
          else if (isPatchFile(part.name)) patches.push({ name: part.name, patch: JSON.parse(part.text) as PatchIndex });
        } catch (e) {
          this.error = `${part.name} is not valid JSON: ${(e as Error).message}`;
          return;
        }
      }
      if (!patches.length) {
        this.error = "No patch.json or patch.*.json among the picked files.";
        return;
      }
      try {
        const { merged, entries } = listEntries(patches);
        this.merged = markRaw(merged);
        this.entries = markRaw(entries);
      } catch (e) {
        // mergePatches refuses entries two files cannot both set; New Recruit would refuse them too.
        this.error = (e as Error).message;
        return;
      }
      this.files = patches.map((p) => p.name);
      this.review = review;
      this.reviewPath = reviewPath;
      this.reviewError = "";
      this.compute();
      this.selectedKey = this.rows.find((r) => !this.decisionOf(r))?.info.key ?? this.rows[0]?.info.key ?? "";
    },
    async readParts(paths: string[]): Promise<Array<{ name: string; text: string }>> {
      const parts = [];
      for (const path of paths) {
        const file = await readFile(path);
        parts.push({ name: file.name ?? path.split("/").pop() ?? path, text: file.data });
      }
      return parts;
    },
    async openFolder() {
      try {
        let folder: string | undefined;
        if (globalThis.electron) {
          const result = await showOpenDialog({ properties: ["openDirectory"] });
          folder = result?.filePaths?.[0]?.replaceAll("\\", "/");
        } else {
          folder = await pickFolder();
        }
        if (!folder) return;
        const listed = await listFolder(folder, 0);
        const paths = listed.filter((f) => !f.directory && (isPatchFile(f.name) || f.name === REVIEW_FILE)).map((f) => f.path);
        this.load(await this.readParts(paths), `${folder}/${REVIEW_FILE}`);
      } catch (e) {
        // A closed picker is not an error.
        if ((e as Error).name === "AbortError") return;
        this.error = `Could not read the folder: ${(e as Error).message}`;
        console.error(e);
      }
    },
    async openFiles() {
      if (!globalThis.electron) {
        (this.$refs.fileInput as HTMLInputElement).click();
        return;
      }
      try {
        const result = await showOpenDialog({ properties: ["openFile", "multiSelections"], filters: [{ name: "Patch", extensions: ["json"] }] });
        const paths = (result?.filePaths ?? []).map((p) => p.replaceAll("\\", "/"));
        if (!paths.length) return;
        const review = `${dirname(paths[0])}/${REVIEW_FILE}`;
        const parts = await this.readParts(paths);
        // The review file beside the patch is picked up even when it was not selected.
        if (!parts.some((p) => p.name === REVIEW_FILE)) {
          try {
            parts.push(...(await this.readParts([review])));
          } catch {
            // No review yet: this is the first session on this patch.
          }
        }
        this.load(parts, review);
      } catch (e) {
        this.error = `Could not read the files: ${(e as Error).message}`;
        console.error(e);
      }
    },
    async filesPicked(event: Event) {
      const input = event.target as HTMLInputElement;
      const parts = await Promise.all([...(input.files ?? [])].map(async (f) => ({ name: f.name, text: await f.text() })));
      input.value = "";
      if (parts.length) this.load(parts, "");
    },
    async saveReview() {
      if (!this.reviewPath) return;
      try {
        await writeFile(this.reviewPath, serializeReview(this.review));
        this.reviewError = "";
      } catch (e) {
        this.reviewError = `Could not save ${REVIEW_FILE}: ${(e as Error).message}`;
        console.error(e);
      }
    },
    downloadReview() {
      const url = URL.createObjectURL(new Blob([serializeReview(this.review)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = REVIEW_FILE;
      a.click();
      URL.revokeObjectURL(url);
    },
    record(row: ReviewRow, status: Decision, comment?: string) {
      this.review.decisions[row.info.key] = {
        status,
        date: new Date().toISOString(),
        ...(comment?.trim() ? { comment: comment.trim() } : {}),
        fingerprint: row.info.fingerprint,
      };
    },
    /** Approving replays the entry through the store, so it lands as an unsaved edit on the undo stack. */
    async apply(row: ReviewRow): Promise<number> {
      let applied = 0;
      for (const target of row.targets) applied += await applyChanges(this.store as unknown as EditPath<EditorBase>, target.changes);
      return applied;
    },
    async decide(row: ReviewRow, status: Decision, comment: string) {
      this.busy = true;
      try {
        if (status === "approved") await this.apply(row);
        this.record(row, status, comment);
        this.compute();
        await this.saveReview();
        this.next(row);
      } catch (e) {
        notify({ type: "error", text: `Could not apply ${row.info.key}: ${(e as Error).message}` });
        console.error(e);
      } finally {
        this.busy = false;
      }
    },
    async bulk(rows: ReviewRow[], status: Decision) {
      // Bulk approval leaves stale and dead entries alone: each of those needs a look.
      const todo = rows.filter((r) => !this.decisionOf(r) && (status === "rejected" || r.status === "applies" || r.status === "in-data"));
      if (!todo.length) {
        notify({ type: "info", text: "Nothing pending here that can be decided in bulk" });
        return;
      }
      this.busy = true;
      const from = this.store.undoStackPos;
      try {
        for (const row of todo) {
          if (status === "approved") await this.apply(row);
          this.record(row, status);
        }
        notify(`${status === "approved" ? "Approved" : "Rejected"} ${todo.length} entr${todo.length === 1 ? "y" : "ies"}`);
      } catch (e) {
        notify({ type: "error", text: `Bulk ${status} stopped: ${(e as Error).message}` });
        console.error(e);
      } finally {
        // The whole batch is one Ctrl+Z.
        this.store.collapse_undo(from, "patch");
        this.compute();
        await this.saveReview();
        this.busy = false;
      }
    },
    decideSelected(status: Decision, comment: string) {
      if (this.selectedRow) return this.decide(this.selectedRow, status, comment);
    },
    clearSelected() {
      if (this.selectedRow) return this.clear(this.selectedRow);
    },
    goto(node: EditorBase) {
      return this.store.goto(node);
    },
    async clear(row: ReviewRow) {
      delete this.review.decisions[row.info.key];
      this.compute();
      await this.saveReview();
    },
    /** Moves on to the next undecided entry in list order, the way a reviewer works down the list. */
    next(after: ReviewRow) {
      const order = this.grouped.flatMap((f) => f.groups.flatMap((g) => g.rows));
      const start = order.findIndex((r) => r.info.key === after.info.key);
      const pending = [...order.slice(start + 1), ...order.slice(0, start)].find((r) => !this.decisionOf(r));
      if (pending) this.selectedKey = pending.info.key;
    },
    async saveAll() {
      await this.store.save_all(this.systemId);
    },
    beforeUnload(event: BeforeUnloadEvent) {
      if (globalThis._closeWindow || !this.store.unsavedCount) return;
      event.returnValue = "You have unsaved changes that will be lost";
      if (globalThis.electron) {
        setTimeout(async () => {
          const result = await showMessageBox({
            message: "You have unsaved changes that will be lost?",
            buttons: ["Cancel", "Leave"],
            defaultId: 0,
            cancelId: 0,
            type: "question",
          });
          if (result === 1) {
            globalThis._closeWindow = true;
            closeWindow();
          }
        });
      }
      return false;
    },
  },
});
</script>

<style scoped lang="scss">
@use "@/shared_components/css/vars.scss" as *;

.crumb-sep {
  color: #cbd5e1;
  margin: 0 2px;
}
.page {
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  padding: 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bar,
.counts {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.spacer {
  flex: 1;
}
.hidden {
  display: none;
}
.muted {
  color: $gray;
}
.small {
  font-size: 13px;
}
.warn {
  color: $red;
}
.pad {
  padding: 10px;
}
.issue {
  padding: 6px 8px;
  border-left: 3px solid $red;
  background: rgba(248, 81, 73, 0.1);
}
.empty {
  max-width: 720px;
  line-height: 1.5;
}
.chip {
  padding: 2px 10px;
  border: 1px solid $box_border;
  border-radius: 10px;
  background: $input_background;
  cursor: pointer;
  font-size: 13px;
  &.active {
    border-color: $blue;
    color: $blue;
  }
}
.find {
  margin-left: auto;
  width: 280px;
  padding: 4px 8px;
}
.split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(360px, 45%) 1fr;
  gap: 10px;
}
.list,
.detail-pane {
  min-height: 0;
  overflow: auto;
  border: 1px solid $box_border;
}
.detail-pane {
  padding: 10px;
}
.file-head,
.group-head,
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  white-space: nowrap;
}
.file-head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: $background_color;
  font-weight: bold;
  border-bottom: 1px solid $box_border;
  padding: 6px 8px;
}
.group-head {
  background: rgba(128, 128, 128, 0.12);
  padding-left: 16px;
}
.grow {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row {
  cursor: pointer;
  padding-left: 28px;
  font-size: 14px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.12);
  &:hover {
    background-color: $hoverColor;
  }
  &.selected {
    background-color: rgba(45, 156, 225, 0.15);
  }
  .label {
    flex: none;
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ops {
    flex: none;
    font-size: 12px;
  }
  .note {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
  }
}
.dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: $gray;
  &.applies {
    background: $blue;
  }
  &.stale {
    background: #b7791f;
  }
  &.in-data {
    background: #4a7c59;
  }
  &.no-match {
    background: $red;
  }
}
.mark {
  flex: none;
  width: 16px;
  text-align: center;
  font-weight: bold;
  &.approved {
    color: #2f855a;
  }
  &.rejected {
    color: #9b2c2c;
  }
}
.inputstyle.small {
  padding: 1px 8px;
  font-size: 12px;
  font-weight: normal;
}
.typeIcon {
  width: 16px;
  height: 16px;
  vertical-align: middle;
  margin-right: 4px;
}
</style>

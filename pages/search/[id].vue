<template>
  <div class="page">
    <!-- Breadcrumb in the title bar. Guarded on $router.currentRoute, not $route: under keep-alive
         $route stays frozen on this page's own route forever (see catalogue.vue's route_is_catalogue),
         and the teleport would linger in the bar on other pages. -->
    <Teleport to="#titlebar-content" v-if="system && $router.currentRoute.value.name === 'search-id'">
      <span class="ml-10px">
        {{ system.gameSystem?.gameSystem?.name || "System" }}
        <span class="crumb-sep">&rsaquo;</span> Search
      </span>
    </Teleport>
    <div class="bars" v-if="catalogue">
      <span class="lbl">find</span>
      <UtilQueryInput v-model="filter" :catalogue="catalogue" :catalogues="files" :resolve="resolve" @submit="search" class="box" />
      <div class="side">
        <button class="inputstyle" @click="search">Search</button>
        <span v-if="searching">Searching…</span>
        <template v-else-if="all">
          <template v-if="groups">
            <span>{{ groups.length.toLocaleString() }} groups</span>
            <span class="muted">· {{ grouped.toLocaleString() }} of {{ all.length.toLocaleString() }} results</span>
          </template>
          <span v-else>{{ all.length.toLocaleString() }} results</span>
        </template>
        <div class="pager" v-if="all && lastPage > 0">
          <button class="inputstyle w-28px" :disabled="page === 0" @click="page--">&lt;</button>
          <span>{{ page + 1 }} / {{ lastPage + 1 }}</span>
          <button class="inputstyle w-28px" :disabled="page === lastPage" @click="page++">&gt;</button>
        </div>
      </div>
      <span class="lbl">then</span>
      <UtilQueryInput v-model="then" :catalogue="catalogue" :catalogues="files" :resolve="resolve" then placeholder="by:id count:>1 sort:-count" @submit="search" class="box" />
      <div class="presets">
        <span class="muted">Presets</span>
        <span
          v-for="p in allPresets ? presets : presets.slice(0, PRESETS_SHOWN)"
          :key="p.label"
          class="preset"
          :class="{ active: filter === p.find && then === p.then }"
          @click="usePreset(p)"
        >
          {{ p.label }}
        </span>
        <span class="preset more" @click="allPresets = !allPresets">{{ allPresets ? "less" : `+${presets.length - PRESETS_SHOWN} more` }}</span>
      </div>
    </div>

    <div v-if="selected.size" class="actionbar">
      <span class="bold">{{ selected.size.toLocaleString() }} selected</span>
      <button class="inputstyle" @click="selected.clear()">Clear</button>
      <span class="sep"></span>
      <span class="copywrap" v-click-outside="{ handler: () => (copyMenu = false), capture: true }">
        <button class="inputstyle" @click="copyMenu = !copyMenu">Copy ▾</button>
        <div v-if="copyMenu" class="copymenu">
          <div @click="copySelected('names')">Names</div>
          <div @click="copySelected('list')">Name — path, by file</div>
          <div @click="copySelected('ids')">Ids</div>
          <div @click="copySelected('query')">As query (id:a|b|…)</div>
        </div>
      </span>
      <button class="inputstyle danger" @click="deleteOpen = true">Delete</button>
      <span class="copywrap" v-click-outside="{ handler: () => (actionsMenu = false), capture: true }">
        <button class="inputstyle" @click="openActions">Actions ▾</button>
        <div v-if="actionsMenu" class="copymenu">
          <div v-if="!scriptActions.length" class="muted none">No script actions for this selection</div>
          <div v-for="a in scriptActions" :key="a.label" @click="runAction(a)">{{ a.label }}</div>
          <div class="addown" @click="((actionsMenu = false), (actionsHelp = true))">Add your own…</div>
        </div>
      </span>
      <span class="sep"></span>
      <span class="muted">set</span>
      <UtilAutocomplete class="editfield" v-model="editKey" :options="editOptions" placeholder="field" nullable>
        <template #option="{ option }">{{ option ?? "field" }}</template>
      </UtilAutocomplete>
      <span class="muted">to</span>
      <input
        class="editvalue"
        type="text"
        v-model="editValue"
        placeholder="value"
        :title="'true/false and numbers are typed as such; quote to force text; empty deletes the attribute'"
        @keydown.enter="applyEdit"
      />
      <button class="inputstyle" :disabled="!editKey.trim()" @click="applyEdit">Apply</button>
    </div>

    <PopupDialog v-if="deleteOpen" v-model="deleteOpen" button="Delete" @button="applyDelete">
      <template #header>Delete {{ selected.size }} nodes?</template>
      <div class="editform">
        <div v-for="[file, n] in deleteSummary.perFile" :key="file">{{ n }} in {{ file }}</div>
        <p v-if="deleteSummary.linked" class="warn">
          {{ deleteSummary.linked }} of them are still linked or named from outside the selection — those links go dead.
        </p>
        <p class="muted small">Undoable with Ctrl+Z. Files are only written when you save them.</p>
      </div>
    </PopupDialog>

    <PopupDialog v-if="actionsHelp" v-model="actionsHelp" x slotstyle="max-width: 640px">
      <template #header>Adding your own actions</template>
      <div class="actionshelp">
        <p>
          Any script with a <code>context</code> hook shows up in this menu. When the menu opens, the hook is handed the
          selected rows and returns the entries it wants to offer — or nothing to stay hidden. The same hook powers the
          tree's right-click menu.
        </p>
        <pre>export default {
  name: "My action",
  hooks: {
    context(event, { selections, catalogues, system }) {
      if (!selections.length) return
      return {
        label: "Comment " + selections.length + " nodes",
        run: () => {
          for (const node of selections) {
            $store.edit_node(node, { comment: "todo: check this" })
          }
        },
      }
    },
  },
}</pre>
        <p class="muted">
          <NuxtLink :to="`/scripts/${$route.params.id}`">Scripts page</NuxtLink> → New script → the “Menu action”
          template starts you off.
        </p>
      </div>
    </PopupDialog>

    <!-- Groups: the then box had a by: -->
    <div v-if="groups" class="results" ref="results" @scroll.passive="scroll = ($event.target as HTMLElement).scrollTop">
      <table>
        <thead>
          <tr>
            <th class="check"><input type="checkbox" :checked="allPageSelected" @change="togglePage" /></th>
            <th class="w-26px"></th>
            <th>{{ byKeys.join(" + ") }}</th>
            <th class="num">count</th>
            <th>kinds</th>
            <th>files</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(g, i) in pageGroups" :key="i">
            <tr class="row" :class="{ open: expanded[g.key.join('\t')] }" @click="toggleGroup(g)">
              <td class="check" @click.stop>
                <input type="checkbox" :checked="g.nodes.every((n) => selected.has(n))" @change="toggleMany(g.nodes, ($event.target as HTMLInputElement).checked)" />
              </td>
              <td><span class="chev" :class="{ down: expanded[g.key.join('\t')] }"></span></td>
              <td>
                <div v-if="byKeys.length === 1 && byKeys[0] === 'logic'" class="logic">
                  <div v-for="(line, j) in describe(g.nodes[0])" :key="j" :style="{ paddingLeft: `${line.depth * 16}px` }" :class="{ muted: line.depth }">
                    <img class="typeIcon" :src="`assets/bsicons/${line.node.editorTypeName}.png`" />{{ getName(line.node) }}
                  </div>
                </div>
                <span v-else class="name">
                  <img v-if="icon(g)" class="typeIcon" :src="`assets/bsicons/${icon(g)}.png`" />
                  <span v-for="(k, j) in g.key" :key="j"><span v-if="j" class="muted"> + </span>{{ display(k) || "(none)" }}</span>
                </span>
              </td>
              <td class="num">{{ g.nodes.length }}</td>
              <td class="kind">{{ g.kinds.join(" · ") }}</td>
              <td class="files">
                <span v-for="f in g.files.slice(0, 3)" :key="f" class="file"><img class="typeIcon" src="assets/bsicons/catalogue.png" />{{ f }}</span>
                <span v-if="g.files.length > 3" class="muted">+{{ g.files.length - 3 }}</span>
              </td>
            </tr>
            <template v-if="expanded[g.key.join('\t')]">
              <tr v-for="item in g.nodes" :key="item.id ?? getName(item)" class="row member" @click="store.goto(item)">
                <td class="check" @click.stop>
                  <input type="checkbox" :checked="selected.has(item)" @change="toggle(item)" />
                </td>
                <td></td>
                <td>
                  <span class="name">
                    <img class="typeIcon" :src="`assets/bsicons/${item.editorTypeName}.png`" />{{ getName(item) }}
                    <span class="extra">{{ getNameExtra(item, false) }}</span>
                  </span>
                </td>
                <td class="kind">{{ item.is }}</td>
                <td class="files"><span class="file"><img class="typeIcon" src="assets/bsicons/catalogue.png" />{{ item.catalogue?.name }}</span></td>
                <td class="path" @click.stop><NodePath :path="path(item)" @nodeclick="pathClicked(item, $event)" /></td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Flat results, grouped by file -->
    <div v-else-if="all" class="results" ref="results" @scroll.passive="scroll = ($event.target as HTMLElement).scrollTop">
      <table>
        <thead>
          <tr>
            <th class="check"><input type="checkbox" :checked="allPageSelected" @change="togglePage" /></th>
            <th class="sortable" @click="sortBy('name')">Name <span v-if="sort.key === 'name'">{{ sort.desc ? "▾" : "▴" }}</span></th>
            <th class="sortable" @click="sortBy('kind')">Kind <span v-if="sort.key === 'kind'">{{ sort.desc ? "▾" : "▴" }}</span></th>
            <th>In</th>
            <th class="num sortable" @click="sortBy('refs')">Refs <span v-if="sort.key === 'refs'">{{ sort.desc ? "▾" : "▴" }}</span></th>
            <th v-if="textCounts" class="num sortable" @click="sortBy('textRefs')">Text refs <span v-if="sort.key === 'textRefs'">{{ sort.desc ? "▾" : "▴" }}</span></th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="r in pageRows" :key="r.id">
            <tr v-if="r.file" class="group" @click="collapsed[r.file] = !collapsed[r.file]">
              <td class="check" @click.stop>
                <input type="checkbox" :checked="fileItems(r.file).every((n) => selected.has(n))" @change="toggleMany(fileItems(r.file), ($event.target as HTMLInputElement).checked)" />
              </td>
              <td :colspan="textCounts ? 6 : 5">
                <span class="name">
                  <span class="chev" :class="{ down: !collapsed[r.file] }"></span>
                  <img class="typeIcon" src="assets/bsicons/catalogue.png" />
                  {{ r.file }}
                  <span class="muted">{{ r.count }}</span>
                </span>
              </td>
            </tr>
            <tr v-else-if="r.item" class="row" @click="store.goto(r.item)">
              <td class="check" @click.stop>
                <input type="checkbox" :checked="selected.has(r.item)" @change="toggle(r.item)" />
              </td>
              <td>
                <span class="name">
                  <img class="typeIcon" :src="`assets/bsicons/${r.item.editorTypeName}.png`" />{{ getName(r.item) }}
                  <span class="extra">{{ getNameExtra(r.item, false) }}</span>
                </span>
              </td>
              <td class="kind">{{ r.item.is }}</td>
              <td class="path" @click.stop><NodePath :path="path(r.item)" @nodeclick="pathClicked(r.item, $event)" /></td>
              <td class="num">{{ r.item.refs?.length || "" }}</td>
              <td v-if="textCounts" class="num">{{ textCounts.get(r.item) || "" }}</td>
              <td class="comment">{{ r.item.comment }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script lang="ts">
import { getAtEntryPath, getEntryPathInfo, getName, getNameExtra, shortNames, type EntryPathEntry } from "~/assets/editor/bs_editor";
import NodePath from "~/components/util/NodePath.vue";
import { aggregate, parse, textRefCounts, type Group } from "~/assets/editor/bs_search";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { getDataObject, goodJsonKeys } from "~/assets/shared/battlescribe/bs_main";
import { useEditorStore } from "~/stores/editorStore";
import type { HookAction } from "~/stores/scriptsStore";

interface Preset {
  label: string;
  find: string;
  then: string;
}

const presets: Preset[] = [
  { label: "Duplicate ids", find: "id:any -is:constraint|condition", then: "by:id count:>1" },
  // key:shared*, not shared:true -- that flag also sits on conditions and modifiers.
  { label: "Unused shared", find: "key:shared* refs:0 mentions:0 textRefs:0", then: "" },
  { label: "Dead links", find: "is:*link -target:*", then: "" },
  { label: "Same name, several files", find: "is:entry key:shared*", then: "by:name files:>1" },
  { label: "Duplicate profiles", find: "is:profile", then: "by:name,characteristics count:>1" },
  { label: "Duplicate rules", find: "is:rule", then: "by:name,description count:>1" },
  // The copy-pasted-with-an-argument smell: same long text, different names ("Frenzy (1)", "Frenzy (2)").
  { label: "Same rule text, different names", find: "is:rule description.length:>50", then: "by:description count:>1" },
  { label: "Same profile text, different names", find: "is:profile characteristics:/.{50,}/", then: "by:characteristics count:>1" },
  { label: "Duplicate modifiers", find: "is:modifier", then: "by:logic count:>1" },
  { label: "Same name, same parent", find: "is:entry|group !parent:catalogue|gameSystem", then: "by:name,parent.id count:>1" },
  // The entry's own type attribute: a profile sitting on a type:unit entry that contains type:model entries.
  { label: "Model stats on units, not models", find: "is:profile kind:model parent:entry[type:unit child*:entry[type:model]]", then: "" },
  // { label: "Two model stats on one entry", find: "is:profile kind:model", then: "by:parent.id count:>1" },
  { label: "Units with no cost anywhere", find: "is:entry type:unit -has*:cost[value:>0]", then: "" },
  { label: "Units with no primary category", find: "is:entry type:unit -child:categoryLink[primary:true]", then: "" },
  // Its own modifiers, at any depth of modifier groups -- but not a child entry's, which do not unhide it.
  { label: "Permanently hidden", find: "is:entry hidden:true -child:modifier[field:hidden] -child:modifierGroup[has:modifier[field:hidden]]", then: "" },
  { label: "Unconditional modifiers", find: "is:modifier -child:condition -child:conditionGroup affects:undefined|=self scope:undefined|=self", then: "" },
  { label: "Unused categories", find: "is:categoryEntry refs:0 mentions:0", then: "" },
  { label: "TODOs in comments", find: "comment:todo|fixme|xxx", then: "" },
  { label: "Profiles by type", find: "is:profile", then: "by:typeName" },
  { label: "Categories by use", find: "is:categoryLink", then: "by:targetId" },
  // { label: "Constraint patterns", find: "is:constraint", then: "by:logic" },
  { label: "Most linked entries", find: "is:entryLink|groupLink", then: "by:targetId" },
  { label: "By in-text references", find: "textMentions:>=1", then: "by:textMentions" },
  { label: "Most in-text references", find: "textRefs:>=1", then: "sort:-textRefs" },
];
/** Editing these in bulk breaks identity or references; never offer them. */
const UNEDITABLE = new Set(["id", "targetId", "typeId", "childId", "scope", "field"]);

/** How many preset chips show before "more". */
const PRESETS_SHOWN = 9;

/** `group` -> `selectionEntryGroup`: the icons are named by the long type names. */
const LONG_NAMES: Record<string, string> = Object.fromEntries(Object.entries(shortNames).map(([long, short]) => [short, long]));

/** One line of the flat table: a file header or a node. */
interface Row {
  id: string;
  file?: string;
  count?: number;
  item?: EditorBase;
}

export default defineComponent({
  components: { NodePath },
  setup() {
    return { store: useEditorStore() };
  },
  async created() {
    const system = await this.store.get_or_load_system((this.$route.params as { id: string }).id);
    // The suggestions need a catalogue to look ids up in; the system's own is the one every file
    // shares, and a freshly loaded file has no index or `is` until processed.
    const gst = await system.loadCatalogue({ targetId: system.getId() });
    gst.processForEditor();
    this.system = system;
    this.catalogue = gst;
  },
  // Pages are kept alive, so results survive a trip to the editor; the scroll container does
  // not: keep-alive detaches the DOM (zeroing scrollTop) BEFORE deactivated() fires, so the
  // position is recorded as it happens instead of on the way out.
  activated() {
    // Anything deleted in the editor meanwhile drops out; a removed node has no catalogue.
    if (this.all?.some((n) => !n.catalogue)) {
      this.all = this.all.filter((n) => n.catalogue);
      this.groups = aggregate(this.all, this.then) ?? null;
      for (const n of this.selected) if (!n.catalogue) this.selected.delete(n);
      this.page = Math.min(this.page, this.lastPage);
    }
    this.$nextTick(() => {
      const results = this.$refs.results as HTMLElement | undefined;
      if (results) results.scrollTop = this.scroll;
    });
  },
  watch: {
    page() {
      const results = this.$refs.results as HTMLElement | undefined;
      if (results) results.scrollTop = 0;
    },
  },
  data() {
    return {
      scroll: 0,
      presets,
      PRESETS_SHOWN,
      allPresets: false,
      catalogue: null as Catalogue | null,
      system: null as GameSystemFiles | null,
      filter: "",
      then: "",
      all: null as EditorBase[] | null,
      groups: null as Group[] | null,
      byKeys: [] as string[],
      searching: false,
      page: 0,
      perPage: 100,
      sort: { key: "" as "" | "name" | "kind" | "refs" | "textRefs", desc: false },
      collapsed: {} as Record<string, boolean>,
      expanded: {} as Record<string, boolean>,
      selected: new Set<EditorBase>(),
      textCounts: null as Map<EditorBase, number> | null,
      copyMenu: false,
      editKey: "",
      editValue: "",
      deleteOpen: false,
      actionsHelp: false,
      actionsMenu: false,
      scriptActions: [] as HookAction[],
    };
  },
  computed: {
    sorted(): EditorBase[] {
      const all = this.all ?? [];
      const { key, desc } = this.sort;
      if (!key) return all;
      const measure = (n: EditorBase): string | number =>
        key === "refs"
          ? n.refs?.length ?? 0
          : key === "textRefs"
            ? this.textCounts?.get(n) ?? 0
            : key === "kind"
              ? n.is ?? ""
              : getName(n).toLowerCase();
      const sorted = [...all].sort((a, b) => {
        const x = measure(a);
        const y = measure(b);
        return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      });
      return desc ? sorted.reverse() : sorted;
    },
    /** File headers and their nodes, in one list, so paging is a slice. */
    rows(): Row[] {
      const byFile = new Map<string, EditorBase[]>();
      for (const item of this.sorted) {
        const file = item.catalogue?.name ?? "";
        const list = byFile.get(file);
        if (list) list.push(item);
        else byFile.set(file, [item]);
      }
      const rows: Row[] = [];
      for (const [file, items] of byFile) {
        rows.push({ id: `file:${file}`, file, count: items.length });
        if (!this.collapsed[file]) for (const item of items) rows.push({ id: `${file}/${item.id ?? getName(item)}/${rows.length}`, item });
      }
      return rows;
    },
    pageRows(): Row[] {
      return this.rows.slice(this.page * this.perPage, (this.page + 1) * this.perPage);
    },
    pageGroups(): Group[] {
      return (this.groups ?? []).slice(this.page * this.perPage, (this.page + 1) * this.perPage);
    },
    /** Results inside the groups shown, since `count:` can drop most of what find matched. */
    grouped(): number {
      return (this.groups ?? []).reduce((n, g) => n + g.nodes.length, 0);
    },
    /** Every file of the system, loaded or not, for `catalogue:` suggestions. */
    files(): string[] {
      return (this.system?.getAllCatalogueFiles() ?? []).map((f) => getDataObject(f).name ?? "").filter(Boolean);
    },
    /**
     * Fields the selection can actually carry: what the selected nodes already store, the few
     * commons, and one "characteristic: X" entry per characteristic the selected profiles have.
     */
    editOptions(): string[] {
      const keys = new Set(["name", "comment", "hidden"]);
      const chars = new Set<string>();
      for (const node of this.selected) {
        for (const key of Object.keys(node)) {
          if (goodJsonKeys.has(key) && !UNEDITABLE.has(key)) keys.add(key);
        }
        for (const c of (node as unknown as { characteristics?: Array<{ name?: string }> }).characteristics ?? []) {
          if (c.name) chars.add(`characteristic: ${c.name}`);
        }
      }
      return [...[...keys].sort(), ...[...chars].sort()];
    },
    /** What the header checkbox covers: this page's nodes. */
    pageNodes(): EditorBase[] {
      if (this.groups) return this.pageGroups.flatMap((g) => g.nodes);
      return this.pageRows.flatMap((r) => (r.item ? [r.item] : []));
    },
    allPageSelected(): boolean {
      return this.pageNodes.length > 0 && this.pageNodes.every((n) => this.selected.has(n));
    },
    deleteSummary(): { perFile: Array<[string, number]>; linked: number } {
      const perFile = new Map<string, number>();
      let linked = 0;
      for (const node of this.selected) {
        const file = node.catalogue?.name ?? "?";
        perFile.set(file, (perFile.get(file) ?? 0) + 1);
        const outside = (ref: EditorBase) => !this.selected.has(ref);
        if (node.refs?.some(outside) || node.other_refs?.some(outside)) linked++;
      }
      return { perFile: [...perFile], linked };
    },
    lastPage(): number {
      const n = this.groups ? this.groups.length : this.rows.length;
      return Math.max(0, Math.ceil(n / this.perPage) - 1);
    },
  },
  methods: {
    getName,
    getNameExtra,
    /** The ancestors between the file and the node, for NodePath. */
    path(node: EditorBase) {
      return getEntryPathInfo(node).slice(1, -1);
    },
    /** A click on one ancestor opens it; the path is relative to the node's own file. */
    pathClicked(node: EditorBase, payload: { path: EntryPathEntry[] }) {
      const target = node.catalogue && getAtEntryPath(node.catalogue, payload.path);
      if (target) this.store.goto(target as EditorBase);
    },
    /**
     * An id anywhere in the system. Catalogue.findOptionById only reaches its own file and its
     * imports, so a target in a sibling catalogue would stay an id.
     */
    resolve(id: string) {
      return this.system?.findOptionById(id);
    },
    /**
     * An icon for a group where one is honest: the node its key resolves to, the kind when the
     * key is a kind, or the members' kind when they all share one. A mixed group gets none.
     */
    icon(g: Group): string | undefined {
      const node = g.key.length === 1 ? this.resolve(g.key[0]) : undefined;
      if (node?.editorTypeName) return node.editorTypeName;
      if (g.key.length === 1 && this.byKeys[0] === "is") return LONG_NAMES[g.key[0]] ?? g.key[0];
      if (g.kinds.length === 1) return LONG_NAMES[g.kinds[0]] ?? g.kinds[0];
      return undefined;
    },
    /**
     * A `by:logic` group, as a person reads it: the first member's label and, indented, every
     * condition, group and repeat under it. Every member has the same logic, so one will do.
     */
    describe(node: EditorBase, depth = 0): Array<{ node: EditorBase; depth: number }> {
      const lines = [{ node, depth }];
      const record = node as unknown as Record<string, unknown>;
      for (const key of ["conditions", "conditionGroups", "localConditionGroups", "repeats", "modifiers", "modifierGroups"]) {
        // isArray, not ?? []: on a repeat node, `repeats` is the NUMBER of repeats, not children.
        const list = record[key];
        if (Array.isArray(list)) for (const child of list) lines.push(...this.describe(child, depth + 1));
      }
      return lines;
    },
    /** A group value that is an id shows as the name it resolves to. */
    display(value: string): string {
      return this.resolve(value)?.getName?.() ?? value;
    },
    sortBy(key: "name" | "kind" | "refs" | "textRefs") {
      this.sort = this.sort.key === key ? { key: this.sort.desc ? "" : key, desc: !this.sort.desc } : { key, desc: false };
      this.page = 0;
    },
    toggleGroup(g: Group) {
      const id = g.key.join("\t");
      this.expanded[id] = !this.expanded[id];
    },
    /**
     * The same actions a right-click on this selection would offer in the tree: every script's
     * `context` hook, fed the search selection. Collected on open -- hooks read the selection.
     */
    openActions() {
      const selections = [...this.selected];
      const catalogues = [...new Set(selections.map((o) => o.getCatalogue()))];
      this.scriptActions = this.store.scripts.run_hooks_sync("context", undefined, {
        selections,
        system: catalogues[0]?.getSystem(),
        catalogues,
      });
      this.actionsMenu = !this.actionsMenu;
    },
    async runAction(action: HookAction) {
      this.actionsMenu = false;
      await action.run();
      // A script may have edited or removed what the table shows.
      if (this.all) {
        this.all = this.all.filter((n) => n.catalogue);
        this.groups = aggregate(this.all, this.then) ?? null;
      }
    },
    toggle(node: EditorBase) {
      if (this.selected.has(node)) this.selected.delete(node);
      else this.selected.add(node);
    },
    toggleMany(nodes: EditorBase[], on: boolean) {
      for (const node of nodes) (on ? this.selected.add(node) : this.selected.delete(node));
    },
    togglePage(e: Event) {
      this.toggleMany(this.pageNodes, (e.target as HTMLInputElement).checked);
    },
    fileItems(file: string): EditorBase[] {
      return this.sorted.filter((n) => (n.catalogue?.name ?? "") === file);
    },
    async copySelected(what: "names" | "list" | "ids" | "query") {
      const nodes = [...this.selected];
      let lines: string[];
      if (what === "names") lines = nodes.map((n) => getName(n));
      else if (what === "ids") lines = nodes.flatMap((n) => (n.id ? [n.id] : []));
      else if (what === "query") lines = [`id:${nodes.flatMap((n) => (n.id ? [n.id] : [])).join("|")}`];
      else {
        // Grouped under a heading per file, so a paste reads as a report rather than a dump.
        const byFile = new Map<string, string[]>();
        for (const n of nodes) {
          const line = [getName(n), this.path(n).map((e) => e.name).join(" > ")].filter(Boolean).join(" — ");
          const file = n.catalogue?.name ?? "?";
          byFile.get(file)?.push(line) ?? byFile.set(file, [line]);
        }
        lines = [...byFile].flatMap(([file, rows], i) => [...(i ? [""] : []), `# ${file}`, ...rows]);
      }
      await navigator.clipboard.writeText(lines.join("\n"));
      this.copyMenu = false;
      notify(`Copied ${what === "query" ? "query for" : ""} ${nodes.length} nodes`);
    },
    applyEdit() {
      const key = this.editKey.trim();
      if (!key) return;
      const raw = this.editValue.trim();
      // A characteristic is a child node, not an attribute: edit the $text of the one by that
      // name on each selected profile. Text stays text -- no true/number coercion here.
      if (key.startsWith("characteristic:")) {
        const name = key.slice("characteristic:".length).trim();
        const chars = [...this.selected].flatMap(
          (n) => ((n as unknown as { characteristics?: EditorBase[] }).characteristics ?? []).filter((c) => (c as { name?: string }).name === name),
        );
        if (!chars.length) return notify({ type: "error", text: `Nothing selected has a "${name}" characteristic` });
        this.store.edit({ $text: raw }, chars);
        return notify(`Set ${name} on ${chars.length} profiles — Ctrl+Z undoes it`);
      }
      // Typed the way the files store them; quotes force text, empty deletes.
      const value =
        raw === ""
          ? undefined
          : /^".*"$/.test(raw)
            ? raw.slice(1, -1)
            : raw === "true" || raw === "false"
              ? raw === "true"
              : /^-?\d+(\.\d+)?$/.test(raw)
                ? Number(raw)
                : raw;
      this.store.edit({ [key]: value }, [...this.selected]);
      notify(`Set ${key} on ${this.selected.size} nodes — Ctrl+Z undoes it`);
    },
    async applyDelete() {
      // remove() resolves paths against the first node's catalogue, so one call per file.
      const byFile = new Map<string, EditorBase[]>();
      for (const node of this.selected) {
        const id = node.catalogue?.id ?? "?";
        byFile.get(id)?.push(node) ?? byFile.set(id, [node]);
      }
      const total = this.selected.size;
      // One remove() per file (it resolves paths against a single catalogue), one undo entry overall.
      const from = this.store.undoStackPos;
      for (const nodes of byFile.values()) await this.store.remove(nodes);
      this.store.collapse_undo(from, "remove");
      this.selected.clear();
      this.deleteOpen = false;
      if (this.all) {
        this.all = this.all.filter((n) => n.catalogue);
        this.groups = aggregate(this.all, this.then) ?? null;
      }
      notify(`Deleted ${total} nodes in ${byFile.size} files — Ctrl+Z undoes it; save when happy`);
    },
    usePreset(p: Preset) {
      this.filter = p.find;
      this.then = p.then;
      this.search();
    },
    async search() {
      if (!this.catalogue) return;
      try {
        this.searching = true;
        await this.$nextTick();
        await new Promise((resolve) => setTimeout(resolve, 5));
        const system = await this.store.get_or_load_system((this.$route.params as { id: string }).id);
        this.all = await this.store.system_search(system, { filter: this.filter });
        // Separately caught: a grouping failure should say so, not silently show the flat table.
        try {
          this.groups = this.all ? aggregate(this.all, this.then) ?? null : null;
        } catch (e) {
          this.groups = null;
          console.error(e);
          notify({ type: "error", text: `Grouping failed: ${(e as Error).message}` });
        }
        // A query about text references earns its own column. Counted over everything, not the
        // result set: the texts doing the referencing are usually not among the matches.
        this.textCounts =
          this.all && /\btextRefs\b/.test(this.filter)
            ? textRefCounts(this.store.query("is:*", [...system.getAllLoadedCatalogues()]))
            : null;
        this.byKeys = parse(this.then)
          .find((t) => t.key === "by")
          ?.alts.flatMap((a) => a.text.split(",")) ?? [];
        // With no by:, a sort: falls through to the flat table's column sort -- otherwise it
        // only ever meant group order and was silently ignored on flat results.
        if (!this.groups) {
          const want = parse(this.then).find((t) => t.key === "sort")?.alts[0]?.text ?? "";
          const desc = want.startsWith("-");
          const key = desc ? want.slice(1) : want;
          if (["name", "kind", "refs", "textRefs"].includes(key)) {
            this.sort = { key: key as "name" | "kind" | "refs" | "textRefs", desc };
          }
        }
        this.expanded = {};
        this.collapsed = {};
        this.selected.clear();
      } catch (e) {
        console.error(e);
      } finally {
        this.page = 0;
        this.searching = false;
      }
    },
  },
});
</script>

<style scoped lang="scss">
@use "@/shared_components/css/vars.scss" as *;

/* Teleported into the title bar. */
.crumb-sep {
  color: #cbd5e1; // the text-slate-300 the bar's secondary text already uses
  margin: 0 2px;
}

// The query bars stay put; only the results scroll.
.page {
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  padding: 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bars {
  display: grid;
  grid-template-columns: 44px 520px auto;
  gap: 6px 8px;
  align-items: center;
}
.lbl {
  color: $gray;
  font-size: 14px;
  text-align: right;
}
.box {
  display: flex;
}
.side {
  display: flex;
  align-items: center;
  gap: 8px;
}
.muted {
  color: $gray;
}
.presets {
  grid-column: 2 / 4;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 13px;
}
.preset {
  padding: 2px 8px;
  border: 1px solid $box_border;
  border-radius: 10px;
  background: $input_background;
  cursor: pointer;
  &:hover,
  &.active {
    border-color: $blue;
  }
  &.active {
    color: $blue;
  }
  &.more {
    border-style: dashed;
    color: $gray;
  }
}

.results {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid $box_border;
  background: rgba(0, 0, 0, 0.1);
}
thead th {
  position: sticky;
  top: 0;
  background: $background_color;
  z-index: 1;
}
table {
  border-collapse: collapse;
  width: 100%;
}
th {
  font-weight: normal;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: $gray;
  text-align: left;
  padding: 4px 8px;
  border-bottom: 1px solid $box_border;
  &.sortable {
    cursor: pointer;
    user-select: none;
  }
}
td {
  padding: 3px 8px;
  height: 28px;
  white-space: nowrap;
  border-bottom: 1px solid rgba(128, 128, 128, 0.12);
  vertical-align: middle;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
}
tr.row {
  cursor: pointer;
  &:hover td {
    background-color: $hoverColor;
  }
  &.open td {
    background-color: rgba(45, 156, 225, 0.08);
  }
  &.member td {
    background-color: rgba(0, 0, 0, 0.12);
    height: 26px;
    font-size: 14px;
  }
}
tr.group {
  cursor: pointer;
  td {
    background-color: rgba(128, 128, 128, 0.12);
    font-weight: bold;
    padding-top: 6px;
    padding-bottom: 6px;
  }
  .muted {
    font-weight: normal;
    margin-left: 6px;
  }
}
.name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  .extra {
    color: $gray;
    font-size: 13px;
  }
}
.typeIcon,
:deep(.typeIcon) {
  width: 16px;
  height: 16px;
  vertical-align: middle;
}
// A table cell, not a flex box: a display:flex td leaves table layout and misaligns the columns.
.file {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 4px;
  padding: 0 6px 0 3px;
  border: 1px solid $box_border;
  border-radius: 3px;
  font-size: 13px;
  line-height: 1.5;
  white-space: nowrap;
}
:deep(.gray) {
  color: $gray;
}
th.num,
td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: $cost_color;
}
th.num {
  width: 70px;
  color: $gray;
}
.kind {
  font-size: 13px;
  color: $gray;
}
.path,
.comment {
  color: $gray;
  font-size: 14px;
}
.logic {
  white-space: normal;
  line-height: 1.45;
  .typeIcon {
    margin-right: 5px;
  }
  .muted {
    font-size: 14px;
  }
}
.chev {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-45deg);
  margin: 0 6px 0 2px;
  transition: transform 0.1s;
  &.down {
    transform: rotate(45deg);
  }
}
.actionbar {
  // Above the sticky table header, or the autocomplete's dropdown slides under it.
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  .sep {
    width: 1px;
    align-self: stretch;
    background: $box_border;
  }
  .danger {
    border-color: $red;
  }
}
.copywrap {
  position: relative;
}
.editfield {
  width: 150px;
}
.editvalue {
  width: 140px;
}
.copymenu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 3px;
  z-index: 20;
  .none {
    cursor: default;
    &:hover {
      background: none;
    }
  }
  background: $input_background;
  border: 1px solid $box_border;
  box-shadow: $box_shadow;
  white-space: nowrap;
  > div {
    padding: 4px 10px;
    cursor: pointer;
    &:hover {
      background: $light_blue;
    }
  }
}
.addown {
  border-top: 1px solid $box_border;
  color: gray;
}
.actionshelp {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 600px;
  pre {
    background: rgba(128, 128, 128, 0.12);
    border: 1px solid $box_border;
    padding: 8px 10px;
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.4;
  }
  code {
    background: rgba(128, 128, 128, 0.12);
    padding: 0 3px;
  }
}
th.check,
td.check {
  width: 26px;
  input {
    cursor: pointer;
  }
}
.editform {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 320px;
  label {
    display: flex;
    align-items: center;
    gap: 8px;
    input {
      flex: 1;
    }
  }
  .small {
    font-size: 13px;
    margin: 0;
  }
  .warn {
    color: $red;
    margin: 0;
  }
}
.pager {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
  font-size: 14px;
  button:disabled {
    opacity: 0.4;
  }
}
</style>

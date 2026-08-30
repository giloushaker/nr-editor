<template>
  <div class="page">
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

    <!-- Groups: the then box had a by: -->
    <div v-if="groups" class="results" ref="results">
      <table>
        <thead>
          <tr>
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
                <td></td>
                <td>
                  <span class="name"><img class="typeIcon" :src="`assets/bsicons/${item.editorTypeName}.png`" />{{ getName(item) }}</span>
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
    <div v-else-if="all" class="results" ref="results">
      <table>
        <thead>
          <tr>
            <th class="sortable" @click="sortBy('name')">Name <span v-if="sort.key === 'name'">{{ sort.desc ? "▾" : "▴" }}</span></th>
            <th class="sortable" @click="sortBy('kind')">Kind <span v-if="sort.key === 'kind'">{{ sort.desc ? "▾" : "▴" }}</span></th>
            <th>In</th>
            <th class="num sortable" @click="sortBy('refs')">Refs <span v-if="sort.key === 'refs'">{{ sort.desc ? "▾" : "▴" }}</span></th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="r in pageRows" :key="r.id">
            <tr v-if="r.file" class="group" @click="collapsed[r.file] = !collapsed[r.file]">
              <td colspan="5">
                <span class="name">
                  <span class="chev" :class="{ down: !collapsed[r.file] }"></span>
                  <img class="typeIcon" src="assets/bsicons/catalogue.png" />
                  {{ r.file }}
                  <span class="muted">{{ r.count }}</span>
                </span>
              </td>
            </tr>
            <tr v-else-if="r.item" class="row" @click="store.goto(r.item)">
              <td>
                <span class="name"><img class="typeIcon" :src="`assets/bsicons/${r.item.editorTypeName}.png`" />{{ getName(r.item) }}</span>
              </td>
              <td class="kind">{{ r.item.is }}</td>
              <td class="path" @click.stop><NodePath :path="path(r.item)" @nodeclick="pathClicked(r.item, $event)" /></td>
              <td class="num">{{ r.item.refs?.length || "" }}</td>
              <td class="comment">{{ r.item.comment }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script lang="ts">
import { getAtEntryPath, getEntryPathInfo, getName, shortNames, type EntryPathEntry } from "~/assets/editor/bs_editor";
import NodePath from "~/components/util/NodePath.vue";
import { aggregate, parse, type Group } from "~/assets/editor/bs_search";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { useEditorStore } from "~/stores/editorStore";

interface Preset {
  label: string;
  find: string;
  then: string;
}

const presets: Preset[] = [
  { label: "Duplicate ids", find: "id:any -is:constraint|condition", then: "by:id count:>1" },
  // key:shared*, not shared:true -- that flag also sits on conditions and modifiers.
  { label: "Unused shared", find: "key:shared* refs:0 mentions:0", then: "" },
  { label: "Dead links", find: "is:*link -target:*", then: "" },
  { label: "Same name, several files", find: "is:entry key:shared*", then: "by:name files:>1" },
  { label: "Duplicate profiles", find: "is:profile", then: "by:name,characteristics count:>1" },
  { label: "Duplicate rules", find: "is:rule", then: "by:name,description count:>1" },
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
];
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
  // Pages are kept alive, so results survive a trip to the editor; the scroll container does not.
  deactivated() {
    this.scroll = (this.$refs.results as HTMLElement | undefined)?.scrollTop ?? 0;
  },
  activated() {
    // Anything deleted in the editor meanwhile drops out; a removed node has no catalogue.
    if (this.all?.some((n) => !n.catalogue)) {
      this.all = this.all.filter((n) => n.catalogue);
      this.groups = aggregate(this.all, this.then) ?? null;
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
      sort: { key: "" as "" | "name" | "kind" | "refs", desc: false },
      collapsed: {} as Record<string, boolean>,
      expanded: {} as Record<string, boolean>,
    };
  },
  computed: {
    sorted(): EditorBase[] {
      const all = this.all ?? [];
      const { key, desc } = this.sort;
      if (!key) return all;
      const measure = (n: EditorBase): string | number =>
        key === "refs" ? n.refs?.length ?? 0 : key === "kind" ? n.is ?? "" : getName(n).toLowerCase();
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
    lastPage(): number {
      const n = this.groups ? this.groups.length : this.rows.length;
      return Math.max(0, Math.ceil(n / this.perPage) - 1);
    },
  },
  methods: {
    getName,
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
      const record = node as unknown as Record<string, EditorBase[] | undefined>;
      for (const key of ["conditions", "conditionGroups", "localConditionGroups", "repeats", "modifiers", "modifierGroups"]) {
        for (const child of record[key] ?? []) lines.push(...this.describe(child, depth + 1));
      }
      return lines;
    },
    /** A group value that is an id shows as the name it resolves to. */
    display(value: string): string {
      return this.resolve(value)?.getName?.() ?? value;
    },
    sortBy(key: "name" | "kind" | "refs") {
      this.sort = this.sort.key === key ? { key: this.sort.desc ? "" : key, desc: !this.sort.desc } : { key, desc: false };
      this.page = 0;
    },
    toggleGroup(g: Group) {
      const id = g.key.join("\t");
      this.expanded[id] = !this.expanded[id];
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
        this.groups = this.all ? aggregate(this.all, this.then) ?? null : null;
        this.byKeys = parse(this.then)
          .find((t) => t.key === "by")
          ?.alts.flatMap((a) => a.text.split(",")) ?? [];
        this.expanded = {};
        this.collapsed = {};
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

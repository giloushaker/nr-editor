<template>
  <div class="icwrap">
    <div class="items" v-if="layout === 'grid'">
      <div
        v-for="item of sortedItems"
        class="relative item unselectable"
        :class="{ highlight: opened(item), selected: item === modelValue, match: q && isMatch(item), dim: q && !isMatch(item) }"
        @click="elementClicked(item)"
        @dblclick="elementDoubleClicked(item)"
        @click.middle="debug(item)"
      >
        <img class="icon" :src="getType(item).icon" />
        <div class="cname" :title="name(item)">
          <span class="prefix" v-if="prefixOf(item)">{{ prefixOf(item) }}</span>
          <span class="leaf">{{ leafOf(item) }}</span>
        </div>
        <div class="error flex flex-row">
          <span
            class="my-auto"
            v-if="changed(item)"
            title="This file was changed by another program.
You may want to reload the system through the Systems tab"
          >
            <img class="my-auto align-text-bottom" src="/assets/icons/warning_sign.png" />
          </span>
          <ErrorIcon :errors="errors(item)" />
        </div>
      </div>
      <div class="relative item add unselectable" @click="add">
        <img class="w-40px h-40px" src="/assets/icons/iconeplus.png" />
        <div class="bold text-blue">New</div>
      </div>
    </div>

    <div class="lgroups" v-else>
      <template v-for="group in groupedItems">
        <div class="ghead" v-if="group.label">{{ group.label }}</div>
        <div
          v-for="item of group.items"
          class="lrow unselectable"
          :class="{ opened: opened(item), selected: item === modelValue, match: q && isMatch(item), dim: q && !isMatch(item) }"
          @click="elementClicked(item)"
          @dblclick="elementDoubleClicked(item)"
          @click.middle="debug(item)"
        >
          <img class="licon icon" :src="getType(item).icon" />
          <span class="lname">
            <span class="prefix" v-if="rowDisplay(item, group).head">
              <template v-for="part in parts(rowDisplay(item, group).head)">
                <mark v-if="part.m">{{ part.t }}</mark>
                <template v-else>{{ part.t }}</template>
              </template>
            </span>
            <template v-for="part in parts(rowDisplay(item, group).main)">
              <mark v-if="part.m">{{ part.t }}</mark>
              <template v-else>{{ part.t }}</template>
            </template>
            <span class="prefix" v-if="rowDisplay(item, group).tail">
              <template v-for="part in parts(rowDisplay(item, group).tail)">
                <mark v-if="part.m">{{ part.t }}</mark>
                <template v-else>{{ part.t }}</template>
              </template>
            </span>
          </span>
          <span class="lstatus">
            <span
              v-if="changed(item)"
              title="This file was changed by another program.
You may want to reload the system through the Systems tab"
            >
              <img class="align-text-bottom" src="/assets/icons/warning_sign.png" />
            </span>
            <ErrorIcon :errors="errors(item)" />
          </span>
        </div>
      </template>
      <div class="lrow addrow unselectable" @click="add">
        <span class="lname bold text-blue">+ New</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { addOne, capitalize, sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { BSIData } from "~/assets/shared/battlescribe/bs_types";
import ErrorIcon, { IErrorMessage } from "./ErrorIcon.vue";
import { getDataObject, getDataDbId } from "~/assets/shared/battlescribe/bs_main";
import { useCataloguesStore } from "~/stores/cataloguesState";
import { useEditorStore } from "~/stores/editorStore";
import { useSettingsStore } from "~/stores/settingsState";
export default {
  emits: ["new", "itemClicked", "itemDoubleClicked"],
  setup() {
    return { cataloguesStore: useCataloguesStore(), store: useEditorStore(), settings: useSettingsStore() };
  },
  props: {
    items: {
      type: Array as PropType<BSIData[]>,
      required: true,
    },
    modelValue: {
      required: true,
    },
    // search text, owned by the parent's legend toolbar
    query: {
      type: String,
      default: "",
    },
  },
  methods: {
    debug(item: any) {
      console.log(item);
    },
    getDataObject,
    getType(item: BSIData) {
      if (item.gameSystem) {
        return { icon: "assets/icons/system1.png", order: 1 };
      } else if (item.catalogue?.library) {
        return { icon: "assets/icons/library.png", order: 2 };
      } else {
        return { icon: "assets/icons/book.png", order: 3 };
      }
    },
    isMatch(item: BSIData) {
      if (!this.q.trim()) return false;
      return this.name(item)?.toLowerCase().includes(this.q.trim().toLowerCase());
    },
    // decides which side of the name is greyed: inside a prefix group the header already carries
    // the prefix; when the same leaf repeats across a group (e.g. "X - Library") the leaf is the
    // generic part, so emphasis flips to the prefix
    rowDisplay(
      item: BSIData,
      group: { label: string; genericLeaves?: Set<string> },
    ): { head: string; main: string; tail: string } {
      const prefix = this.prefixOf(item);
      const leaf = this.leafOf(item);
      if (group.label && group.label !== "Libraries") {
        return { head: "", main: leaf, tail: "" };
      }
      if (prefix && group.genericLeaves?.has(leaf)) {
        return { head: "", main: prefix.slice(0, -3), tail: ` - ${leaf}` };
      }
      return { head: prefix, main: leaf, tail: "" };
    },
    // "Imperium - Adeptus Astartes - Blood Angels" -> grey prefix + prominent leaf
    prefixOf(item: BSIData): string {
      const name = this.name(item) || "";
      const idx = name.lastIndexOf(" - ");
      return idx === -1 ? "" : name.slice(0, idx + 3);
    },
    leafOf(item: BSIData): string {
      const name = this.name(item) || "";
      const idx = name.lastIndexOf(" - ");
      return idx === -1 ? name : name.slice(idx + 3);
    },
    // splits text into plain/matching parts so the query can be highlighted without v-html
    parts(text: string): Array<{ t: string; m: boolean }> {
      const query = this.q.trim().toLowerCase();
      if (!query) return [{ t: text, m: false }];
      const result = [];
      let rest = text;
      let idx = rest.toLowerCase().indexOf(query);
      while (idx !== -1) {
        if (idx > 0) result.push({ t: rest.slice(0, idx), m: false });
        result.push({ t: rest.slice(idx, idx + query.length), m: true });
        rest = rest.slice(idx + query.length);
        idx = rest.toLowerCase().indexOf(query);
      }
      if (rest) result.push({ t: rest, m: false });
      return result;
    },
    openFirstMatch() {
      const first = this.sortedItems.find((o: BSIData) => this.isMatch(o));
      if (first) {
        this.$emit("itemDoubleClicked", first);
      }
    },
    elementDoubleClicked(item: BSIData) {
      this.$emit("itemDoubleClicked", item);
    },
    elementClicked(item: BSIData) {
      this.$emit("itemClicked", item);
    },
    changed(data: BSIData) {
      return this.store.get_catalogue_state(data).isChangedOnDisk;
    },
    errors(data: BSIData): IErrorMessage[] {
      const result = [] as IErrorMessage[];
      if (this.store.get_catalogue_state(data)?.unsaved) {
        result.push({
          severity: "info",
          msg: "Unsaved",
        });
      }
      const errors = (getDataObject(data) as any as { errors: IErrorMessage[] }).errors;

      if (errors?.length) {
        const counts = {} as Record<string, number>;

        for (const error of errors) {
          if (error.severity) {
            addOne(counts, error.severity);
          } else {
            addOne(counts, "error");
          }
        }

        let msgPieces = [];
        for (const key in counts) {
          msgPieces.push(`${counts[key]} ${capitalize(key)}${counts[key] === 1 ? "" : "s"}`);
        }
        if (errors.find((o) => o.severity === "error")) {
          result.push({
            severity: "error",
            msg: `Has ${msgPieces.join(", ")}`,
          });
        } else if (errors.find((o) => o.severity === "warning")) {
          result.push({
            severity: "warning",
            msg: `Has ${msgPieces.join(", ")}`,
          });
        }
      }
      return result;
    },
    opened(data: BSIData) {
      return (getDataObject(data) as any).opened;
    },
    name(data: BSIData) {
      return getDataObject(data).name;
    },
    add() {
      this.$emit("new");
    },
  },
  computed: {
    q(): string {
      return this.query || "";
    },
    layout(): "grid" | "list" {
      return this.settings.catalogueLayout || "grid";
    },
    sortedItems() {
      return sortByAscending(
        sortByAscending(this.items, (o) => this.name(o)),
        (o) => this.getType(o).order
      );
    },
    // system + unprefixed first, prefix groups alphabetically, libraries last
    groupedItems(): Array<{ label: string; items: BSIData[]; genericLeaves: Set<string> }> {
      // group labels come from prefixes; a catalogue named exactly like a group belongs in it
      const prefixKeys = new Set<string>();
      for (const item of this.sortedItems) {
        if (!(item as BSIData).gameSystem && !(item as BSIData).catalogue?.library) {
          const prefix = this.prefixOf(item);
          if (prefix) prefixKeys.add(prefix.slice(0, -3));
        }
      }
      const groups = new Map<string, BSIData[]>();
      for (const item of this.sortedItems) {
        let key = "";
        if ((item as BSIData).catalogue?.library) {
          key = "Libraries";
        } else if (!(item as BSIData).gameSystem) {
          const prefix = this.prefixOf(item);
          if (prefix) {
            key = prefix.slice(0, -3);
          } else if (prefixKeys.has(this.name(item))) {
            key = this.name(item);
          }
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      }
      const labels = [...groups.keys()].filter((k) => k && k !== "Libraries").sort();
      const ordered = ["", "Libraries", ...labels].filter((k) => groups.has(k));
      return ordered.map((label) => {
        const items = groups.get(label)!;
        // the group's namesake catalogue leads its group
        items.sort((a, b) => Number(this.name(b) === label) - Number(this.name(a) === label));
        const leafCounts = new Map<string, number>();
        for (const item of items) {
          const leaf = this.leafOf(item);
          leafCounts.set(leaf, (leafCounts.get(leaf) || 0) + 1);
        }
        const genericLeaves = new Set([...leafCounts.keys()].filter((leaf) => leafCounts.get(leaf)! >= 2));
        return { label, items, genericLeaves };
      });
    },
  },
  watch: {
    q() {
      this.$nextTick(() => {
        (this.$el as HTMLElement)?.querySelector(".match")?.scrollIntoView({ block: "nearest" });
      });
    },
  },
  components: { ErrorIcon },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.item {
  display: grid;
  grid-template-columns: "max-content";
  align-items: center;
  justify-items: center;
  &:last-child {
    margin-right: 0;
  }
  font-size: 12px;
  border: 1px $box_border solid;
  padding: 3px;
  border-radius: 5px;
  box-shadow: $box_shadow;
  color: $fontColor;
  cursor: pointer;
  width: 100px;
  text-align: center;
}

.items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  grid-gap: 5px 0px;
  grid-auto-rows: 1fr;
  align-items: stretch;
}

.error {
  position: absolute;
  right: 5px;
  top: 5px;
}

.item:hover {
  background-color: var(--hover-darken-color, rgba(0, 0, 0, 0.05));
}
/* cards only: on list rows a size-changing border reflows the columns */
.item.selected {
  border: solid currentColor 2px;
  padding: 2px;
}

.highlight {
  background-color: rgba(40, 120, 250, 0.15);
}
.add {
  border: solid rgb(45, 190, 45) 2px;
}

.dim {
  opacity: 0.45;
}
.prefix {
  color: gray;
  opacity: 0.85;
}
.cname {
  max-width: 100%;
  .leaf {
    /* wraps as a unit: stays on one line when it fits, breaks internally only when it can't */
    display: inline-block;
    max-width: 100%;
    vertical-align: bottom;
  }
}
.item.match {
  border-color: rgba(230, 180, 30, 0.9);
}

/* list layout: newspaper flow — headers and rows share the columns, groups may
   continue into the next column without looking broken */
.lgroups {
  columns: 250px;
  column-gap: 18px;
}
.ghead {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: gray;
  padding: 6px 4px 2px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.35);
  break-inside: avoid;
  break-after: avoid;
}
.lrow {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 3px 4px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 1px solid rgba(128, 128, 128, 0.18);
  break-inside: avoid;
  &:hover {
    background-color: var(--hover-darken-color, rgba(0, 0, 0, 0.05));
  }
  &.opened {
    background-color: rgba(40, 120, 250, 0.15);
  }
  &.selected {
    outline: 1.5px solid currentColor;
    outline-offset: -1.5px;
  }
  .licon {
    width: 16px;
    height: 16px;
  }
  .lname {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    mark {
      background: rgba(250, 220, 70, 0.75);
      color: inherit;
      border-radius: 2px;
    }
  }
}
:global(html.dark) .lname mark {
  background: rgba(200, 160, 30, 0.4);
  color: inherit;
}
.lrow .lstatus {
  margin-left: auto;
  display: flex;
  gap: 4px;
  align-items: center;
}
.addrow {
  border-top: 1px solid rgba(45, 190, 45, 0.6);
}
</style>

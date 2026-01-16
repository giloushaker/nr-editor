<template>
  <div class="scrollable max-h-60vh p-10px">
    <div class="mb-10px" v-if="autosort">
      <button class="bouton" id="auto-sort" @click="autoSort(items)">
        AutoSort
        <img
          src="/assets/icons/filtre.png"
          class="cursor-pointer hover-darken right-icon"
          @click.stop.prevent="configure = true"
        />
      </button>
      <PopupDialog v-if="massSort" v-model="massSort" button="Sort" text="Cancel" @button="autoSortAllIn(massSortIn)">
        <div class="text-center" id="auto-sort-all-in">
          In
          <select v-model="massSortIn">
            <option value="catalogue">Catalogue</option>
            <option value="catalogue&imports">Catalogue & Imports</option>
            <option value="all">All Catalogues</option>
          </select>
        </div>
      </PopupDialog>
      <PopupDialog v-if="configure" v-model="configure" button="Mass Sort" @button="massSort = true">
        <div>
          Enter rules for sorting below:
          <br />Possible rules:
        </div>
        <div>
          <span class="cost">type:model</span><span class="cost">type:upgrade</span><span class="cost">type:unit</span
          ><span class="cost">type:mount</span><span class="cost">type:crew</span><span class="cost">type:entry</span
          ><span class="cost">type:group</span><br />
          <span class="cost">cost:{name}</span><br />
          <span class="cost">name</span><span class="cost">name:/{regex}/i</span><br />
        </div>
        <div>
          Multiple rules may be combined on the same line with <span class="cost">&</span> eg:
          <span class="cost">type:group & name:/options/i</span> <br />Higher rules take priority.
        </div>

        <UtilEditableDiv v-model="settings.autosort.config" style="font-family: monospace" spellcheck="false" />
      </PopupDialog>
    </div>
    <div
      v-for="(item, i) in sorted"
      class="p-4px border-solid -mt-1px border-1px hover-darken unselectable 0px drop-item"
      draggable="true"
      @dragstart="dragStart(item)"
      @dragover.prevent
      @drop="drop(realDropIndex)"
      @dragenter="dragEnter($event, i)"
      @dragover="dragEnter($event, i)"
      :class="{
        'drop-target-is-above': realDropIndex === i && !same(i),
        'drop-target-is-below': realDropIndex === i + 1 && !same_below(i + 1),
        dragging: item === dragging,
      }"
    >
      <template v-if="get(item) === undefined">
        <span
          :class="{ gray: get(item) === undefined }"
          title="Will not be ordered specifically (but will be after anything with an index set)"
        >
          [?]
        </span>
      </template>
      <template v-else>
        <span> [{{ get(item) }}] </span>
      </template>
      <slot v-bind="{ item }" name="item"></slot>
      <span
        v-if="get(item) !== undefined"
        class="px-4px py-1px hover-brighten cursor-pointer unselectable float-right"
        @click.stop="del(item)"
        >x</span
      >
    </div>
  </div>
</template>
<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { sortByAscending, sortByAscendingInplace } from "~/assets/shared/battlescribe/bs_helpers";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { AutoSortConfig } from "~/assets/shared/battlescribe/sortorder";
import { useSettingsStore } from "~/stores/settingsState";
type StrOrRegex = string | RegExp;
export default defineComponent({
  props: {
    items: {
      type: Array<Base>,
      required: true,
    },
    get: {
      type: Function as PropType<(item: any) => number | undefined>,
      required: true,
    },
    set: {
      type: Function as PropType<(item: any, val: number) => unknown>,
      required: true,
    },
    del: {
      type: Function as PropType<(item: any) => unknown>,
      required: true,
    },
    autosort: {
      type: Boolean,
      default: true,
    },
    parent: {
      type: Object as PropType<EditorBase>,
    },
  },
  setup() {
    return { settings: useSettingsStore() };
  },
  data() {
    return {
      dragging: null as null | any,
      dropIndex: null as null | number,
      configure: false,
      massSort: false,
      massSortIn: "catalogue" as "catalogue" | "catalogue&imports" | "all",
    };
  },
  computed: {
    sorted() {
      return sortByAscending(this.items, (o) => this.get(o) ?? 10000);
    },

    realDropIndex() {
      if (this.dropIndex === null) return null;
      return Math.min(this.sorted.filter((o) => this.get(o) !== undefined).length, this.dropIndex);
    },
  },
  methods: {
    same(index: number) {
      const item = this.sorted[index];
      if (!this.get(item)) return false;
      if (item !== this.dragging && this.sorted[index - 1] !== this.dragging) return false;
      return true;
    },
    same_below(index: number) {
      const item = this.sorted[index - 1];
      if (!this.get(item)) return false;
      if (item !== this.dragging && this.sorted[index] !== this.dragging) return false;
      return true;
    },
    dragStart(item: any) {
      this.dragging = item;
    },
    dragEnter(e: DragEvent, index: number) {
      const target = (e.target as HTMLElement).closest(".drop-item")!;
      const rect = target.getBoundingClientRect();
      const half = (rect.top + rect.bottom) / 2;
      if (e.clientY > half) {
        index += 1;
      }
      if (this.dragging !== index) {
        this.dropIndex = index;
      } else {
        this.dropIndex = null;
      }
    },
    drop(index: number | null) {
      if (index === null) return;
      const visual_index = index + 1;
      this.dropIndex = null;
      if (this.dragging !== null) {
        const itemsWithIndex = [];
        for (const item of this.sorted) {
          const idx = this.get(item);
          if (idx !== undefined) {
            itemsWithIndex.push({ item, idx });
          }
        }
        if (itemsWithIndex.find((o) => o.idx === visual_index)) {
          for (const { item, idx } of itemsWithIndex) {
            if (idx >= visual_index) {
              this.set(item, idx + 1);
            }
          }
        }
        this.set(this.dragging, visual_index);
        this.fixup();
        this.dragging = null;
      }
    },
    fixup() {
      let i = 1;
      for (const item of this.sorted) {
        if (this.get(item) !== undefined) {
          this.set(item, i);
          i++;
        }
      }
    },
    autoSort(childs: Base[]) {
      const autosorter = new AutoSortConfig(this.settings.autosort.config, this.get, this.set, this.del);
      autosorter.autoSort(childs);
    },
    async autoSortAllIn(all_in: "catalogue" | "catalogue&imports" | "all") {
      if (this.parent) {
        const catalogue = this.parent.catalogue;
        const manager = this.parent.catalogue.manager as GameSystemFiles;
        const autosorter = new AutoSortConfig(this.settings.autosort.config, this.get, this.set, this.del);

        const whitelist = new Set([
          "sharedSelectionEntries",
          "sharedSelectionEntryGroups",
          "selectionEntries",
          "selectionEntryGroups",
        ]);

        const catalogues = [];
        switch (all_in) {
          case "catalogue&imports":
            catalogues.push(...this.parent.catalogue.imports);
          case "catalogue":
            catalogues.push(catalogue);
            break;
          case "all":
            if (all_in === "all") {
              await manager.loadAll();
              catalogues.push(...manager.getAllLoadedCatalogues());
            }
        }

        let affected = 0;
        for (const catalogue of catalogues) {
          catalogue.forEachObjectWhitelist((obj: Base) => {
            const childs = [...obj.localSelectionsIterator()];
            if (childs.length > 1) {
              affected += autosorter.autoSort(childs);
            }
          }, whitelist);
        }
        notify(`Affected ${affected} entries.`);
      }
    },
  },
});
</script>
<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.drop-target-is-above {
  border-top: 4px solid rgb(101, 161, 101);
}

.drop-target-is-below {
  border-bottom: 4px solid rgb(101, 161, 101);
}

.drop-target-is-below + .drop-target-is-above {
  border-top: unset;
}

.dragging {
  color: gray;
  border-style: dashed;
  border-width: 2px;
}

[draggable="true"] {
  cursor: move;
  cursor: grab;
  cursor: -moz-grab;
  cursor: -webkit-grab;
}

.right-icon {
  left: unset;
  right: -1px;
  top: -1px;
  border: 1px solid $box_border;
  padding: 5px 5px 6px 5px;
}

.cost {
  font-family: monospace;
  line-height: 1.5em;
}
</style>

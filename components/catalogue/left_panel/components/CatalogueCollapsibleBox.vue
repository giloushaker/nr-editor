<template>
  <EditorCollapsibleBox nobox :collapsible="items && items.length > 0">
    <template #title> <slot /> </template>
    <template #content v-if="items">
      <CatalogueEntry
        ref="entries"
        v-for="entry of items"
        :item="entry"
        :filter="filter"
        @selected="itemSelected"
      />
    </template>
  </EditorCollapsibleBox>
</template>

<script lang="ts">
import { PropType, VueElement } from "nuxt/dist/app/compat/capi";
import {
  escapeRegex,
  sortByAscending,
  textSearchRegex,
} from "~/assets/shared/battlescribe/bs_helpers";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import EditorCollapsibleBox from "~/components/EditorCollapsibleBox.vue";
import { CatalogueEntry } from "~/.nuxt/components";
import { eventNames } from "process";
export default {
  components: { EditorCollapsibleBox },
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    type: {
      type: String as PropType<keyof Catalogue>,
      required: true,
    },
    filter: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      selected: [] as (typeof CatalogueEntry)[],
      lastSelected: null as typeof CatalogueEntry | null,
    };
  },
  computed: {
    sorted() {
      const items = (this.catalogue[this.type] || []) as Base[];
      return sortByAscending(items, (o) => o.getName());
    },
    items() {
      if (!this.filter) {
        return this.sorted;
      }
      const regx = textSearchRegex(this.filter);
      return this.sorted.filter(
        (o) => !o.getName || !o.getName() || o.getName().match(regx)
      );
    },
    entries(): (typeof CatalogueEntry)[] {
      return this.$refs.entries as (typeof CatalogueEntry)[];
    },
  },

  methods: {
    itemSelected(item: any, $el: typeof CatalogueEntry, e: MouseEvent) {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        for (const selected of this.selected) {
          selected.unselect(item);
        }
      }
      if (e.shiftKey && this.lastSelected) {
        const entries = this.entries;
        const a = entries.findIndex((o) => o === $el);
        const b = entries.findIndex((o) => o === this.lastSelected);
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        for (let i = low; i <= high; i++) {
          entries[i].select();
        }
      } else {
        this.$emit("selected", { type: this.type, item: item });
      }
      this.lastSelected = $el;
      this.selected.push($el);
    },
  },

  created() {},
};
</script>

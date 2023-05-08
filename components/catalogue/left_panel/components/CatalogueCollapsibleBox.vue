<template>
  <EditorCollapsibleBox nobox :collapsible="items && items.length">
    <template #title> <slot /> </template>
    <template #content v-if="items">
      <CatalogueEntry
        v-for="entry of items"
        :item="entry"
        :filter="filter"
        @selected="itemSelected"
      />
    </template>
  </EditorCollapsibleBox>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import {
  escapeRegex,
  sortByAscending,
  textSearchRegex,
} from "~/assets/shared/battlescribe/bs_helpers";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import EditorCollapsibleBox from "~/components/EditorCollapsibleBox.vue";

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
  },

  methods: {
    itemSelected(item: any) {
      this.$emit("selected", { type: this.type, item: item });
    },
  },

  created() {},
};
</script>

<template>
  <fieldset class="mt-10px" v-if="get_sort_items.length > 1">
    <legend>Childs Order</legend>
    <SortOrder :items="get_sort_items" :get="get" :set="set" :del="del" :parent="item" :autosort="autosort">
      <template #item="{ item }">
        <Entry :item="item" noSortIndex />
        <template v-if="item.refs?.length > 1">>1 refs</template>
      </template>
    </SortOrder>
  </fieldset>
</template>
<script lang="ts">
import { PropType } from "vue";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import SortOrder from "./SortOrder.vue";
import Entry from "../../left_panel/Entry.vue";
import { Base } from "~/assets/shared/battlescribe/bs_main";

export default defineComponent({
  props: {
    item: {
      type: Object as PropType<any>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    get_items: {
      type: Function as PropType<(item: any) => Base[]>,
      required: false,
      default: null,
    },
    autosort: {
      type: Boolean,
      default: true,
    },
  },
  setup() {
    return { store: useEditorStore() };
  },
  computed: {
    get_sort_items() {
      return this.get_items(this.item);
    },
  },
  methods: {
    get(item: EditorBase) {
      return item.sortIndex;
    },
    set(item: EditorBase, v: number) {
      item.sortIndex = v;
      this.store.set_catalogue_changed(item.catalogue, true);
    },
    del(item: EditorBase) {
      delete item.sortIndex;
      this.store.set_catalogue_changed(item.catalogue, true);
    },
  },
  components: { SortOrder, Entry },
});
</script>

<template>
  <div class="leftPanel">
    <div class="top">
      <CatalogueEntry :item="catalogue" />
    </div>
    <div class="bottom">
      <input
        v-model="store.filter"
        type="search"
        placeholder="search..."
        class="w-full"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorState";

export default {
  setup() {
    return { store: useEditorStore() };
  },

  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  computed: {
    availableItems() {
      return this.items;
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.leftPanel {
  border: 1px $gray solid;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}
.bottom {
  margin-top: auto;
  position: sticky;
}
.top {
  overflow: auto;
}
</style>

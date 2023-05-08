<template>
  <EditorCollapsibleBox nobox>
    <template #title> <slot /> </template>
    <template #content v-if="items">
      <CatalogueEntryList :entries="items" @selected="itemSelected" />
    </template>
  </EditorCollapsibleBox>
</template>

<script lang="ts">
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
      type: String,
      required: true,
    },
  },

  computed: {
    items() {
      return (this.catalogue as any)[this.type];
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

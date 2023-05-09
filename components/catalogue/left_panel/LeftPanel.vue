<template>
  <div class="leftPanel">
    <div class="top">
      <CatalogueEntry
        :parent="null"
        :item="catalogue"
        @selected="selected"
        :selectedId="selectedId"
        :filter="filter"
        :categories="categories"
        :possibleChildren="possibleChildren"
      />
    </div>
    <div class="bottom">
      <input
        v-model="filter"
        type="search"
        placeholder="search..."
        class="w-full"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Base, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["selected"],
  data() {
    return {
      filter: "",
      selectedId: null as string | null,
      categories: [
        {
          type: "catalogueLinks",
          name: "Catalogue Links",
        },
        {
          type: "publications",
          name: "Publications",
        },
        {
          type: "costTypes",
          name: "Cost Types",
        },
        {
          type: "profileTypes",
          name: "Profile Types",
        },
        {
          type: "categoryEntries",
          name: "Category Entries",
        },
        {
          type: "forceEntries",
          name: "Force Entries",
        },
        {
          type: "sharedProfiles",
          name: "Shared Profiles",
        },
      ] as Array<{ name: string; type: keyof (Base | Link) }>,
      possibleChildren: [
        "catalogueLinks",
        "publications",
        "costTypes",
        "profileTypes",
        "categoryEntries",
        "categoryLinks",
        "forceEntries",
        "selectionEntries",
        "entryLinks",
        "sharedProfiles",
      ] as Array<keyof (Base | Link)>,
    };
  },

  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  methods: {
    selected(item: { item: Base | Link; type: string }) {
      this.selectedId = item.item.id;
      this.$emit("selected", item);
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
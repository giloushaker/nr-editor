<template>
  <div class="leftPanel">
    <div class="top">
      <CatalogueEntry
        :item="catalogue"
        :type="`catalogue`"
        :parent="null"
        @selected="selected"
        :selectedItem="selectedItem"
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
import { ItemTypes, ItemKeys } from "./components/CatalogueEntry.vue";

export default {
  emits: ["selected"],
  data() {
    return {
      filter: "",
      selectedItem: null as ItemTypes | null,
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
          type: "sharedSelectionEntries",
          name: "Shared Selection Entries",
        },
        {
          type: "sharedSelectionEntryGroups",
          name: "Shared Selection Entry Groups",
        },
        {
          type: "sharedProfiles",
          name: "Shared Profiles",
        },
        {
          type: "sharedRules",
          name: "Shared Rules",
        },
        {
          type: "infoGroups",
          name: "Shared Info Groups",
        },
        {
          type: "selectionEntries",
          name: "Root Selection Entries",
        },
        {
          type: "rules",
          name: "Root Rules",
        },
      ] as Array<{ name: string; type: keyof (Base | Link) }>,

      possibleChildren: [
        // Catalogue stuff
        "catalogueLinks",
        "publications",
        "costTypes",
        "profileTypes",
        "sharedProfiles",
        "sharedRules",

        // Modifiable
        "infoLinks",
        "profiles",
        "rules",
        "infoGroups",

        // Children
        "categoryEntries",
        "categoryLinks",
        "forceEntries",
        "selectionEntries",
        "selectionEntryGroups",
        "entryLinks",

        // Constraints and modifiers
        "constraints",
        "conditions",
        "modifiers",
        "modifierGroups",
        "repeats",
        "conditionGroups",
      ] as Array<ItemKeys>,
    };
  },

  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  methods: {
    selected(item: { item: ItemTypes; type: ItemKeys }) {
      this.selectedItem = item.item;
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

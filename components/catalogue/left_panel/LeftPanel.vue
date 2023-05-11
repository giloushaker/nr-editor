<template>
  <div class="leftPanel">
    <div class="top">
      <CatalogueEntry
        ref="entries"
        :item="catalogue"
        :type="`catalogue`"
        :parent="null"
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
  data() {
    return {
      filter: "",
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
          icon: "costs.png",
        },
        {
          type: "profileTypes",
          name: "Profile Types",
          icon: "profiles.png",
        },
        {
          type: "categoryEntries",
          name: "Category Entries",
          icon: "categories.png",
        },
        {
          type: "forceEntries",
          name: "Force Entries",
          icon: "forces.png",
        },
        {
          type: "sharedSelectionEntries",
          name: "Shared Selection Entries",
          icon: "shared_selections.png",
        },
        {
          type: "sharedSelectionEntryGroups",
          name: "Shared Selection Entry Groups",
          icon: "shared_groups.png",
        },
        {
          type: "sharedProfiles",
          name: "Shared Profiles",
          icon: "shared_profiles.png",
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

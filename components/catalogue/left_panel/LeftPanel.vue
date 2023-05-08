<template>
  <div class="leftPanel">
    <div>
      <CatalogueCollapsibleBox
        v-for="item of items"
        :type="item.type"
        :catalogue="catalogue"
        :filter="filter"
        @selected="selected"
      >
        {{ item.name }}
      </CatalogueCollapsibleBox>
    </div>
    <div class="bottom">
      <input
        v-model="filter"
        type="text"
        placeholder="search..."
        class="w-full"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  data() {
    return {
      filter: "",
      items: [
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
      ],
    };
  },

  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  methods: {
    selected(item: any) {
      this.$emit("selected", item);
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
}
</style>

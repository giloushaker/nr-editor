<template>
  <div class="leftPanel">
    <CatalogueCollapsibleBox
      v-for="item of items"
      :type="item.type"
      :catalogue="catalogue"
      @selected="selected"
    >
      {{ item.name }}
    </CatalogueCollapsibleBox>
  </div>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  data() {
    return {
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
}
</style>

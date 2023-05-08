<template>
  <div class="box">
    <CatalogueRightPanelPublicationPanel
      v-if="item.type == 'publications'"
      :item="item.item"
      @catalogueChanged="changed"
    />

    <CatalogueRightPanelCostTypesPanel
      v-if="item.type == 'costTypes'"
      :item="item.item"
      @catalogueChanged="changed"
    >
    </CatalogueRightPanelCostTypesPanel>

    <CatalogueRightPanelProfileTypesPanel
      v-if="item.type == 'profileTypes'"
      :item="item.item"
      @catalogueChanged="changed"
    >
    </CatalogueRightPanelProfileTypesPanel>

    <CatalogueRightPanelSharedProfilesPanel
      v-if="item.type == 'sharedProfiles'"
      :item="item.item"
      @catalogueChanged="changed"
    >
    </CatalogueRightPanelSharedProfilesPanel>
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<{ type: string; item: any }>,
      required: true,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
};
</script>

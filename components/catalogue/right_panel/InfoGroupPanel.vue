<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" />
    <CatalogueRightPanelFieldsBasics :item="item" class="section" />
    <CatalogueRightPanelFieldsReference :catalogue="catalogue" :item="item" class="section" />
    <CatalogueRightPanelFieldsHidden :item="item" class="section">
      Constraints
    </CatalogueRightPanelFieldsHidden>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIInfoGroup } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    item: {
      type: Object as PropType<BSIInfoGroup>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
};
</script>

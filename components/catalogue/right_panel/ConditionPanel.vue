<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" />

    <Condition class="section" :item="item" :catalogue="catalogue" />

    <CatalogueRightPanelFieldsQuery class="section" :item="item" :catalogue="catalogue" childForces childSelections />

    <FilterBy v-if="item.field?.startsWith('limit::') == false && item.editorTypeName !== 'localConditionGroup'" noshared class="section" :item="item" :catalogue="catalogue" />
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import ConditionVue from "./fields/Condition.vue";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import FilterBy from "./fields/FilterBy.vue";
import { Condition } from "~/assets/shared/battlescribe/bs_main";
import { BSICondition } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    item: {
      type: Object as PropType<BSICondition & EditorBase>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
  components: { Condition: ConditionVue, FilterBy },
};
</script>

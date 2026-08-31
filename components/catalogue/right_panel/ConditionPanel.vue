<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" />

    <Condition class="section" :item="item" :catalogue="catalogue" />

    <CatalogueRightPanelFieldsQuery class="section" :item="item" :catalogue="catalogue" childForces childSelections />

    <FilterBy
      v-if="item.field?.startsWith('limit::') == false && item.editorTypeName !== 'localConditionGroup'"
      noshared
      class="section"
      :item="item"
      :catalogue="catalogue"
    />
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { catalogueProp } from "./fields/props";
import ConditionVue from "./fields/Condition.vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import FilterBy from "./fields/FilterBy.vue";
import { Condition } from "~/assets/shared/battlescribe/bs_main";
import type { BSICondition } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    item: {
      type: Object as PropType<Condition & EditorBase>,
      required: true,
    },
    ...catalogueProp,
  },
  components: { Condition: ConditionVue, FilterBy },
};
</script>

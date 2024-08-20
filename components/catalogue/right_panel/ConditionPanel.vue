<template>
  <div>
    <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />

    <Condition class="section" :item="item" @catalogueChanged="changed" :catalogue="catalogue" />

    <CatalogueRightPanelFieldsQuery
      class="section"
      :item="item"
      @catalogueChanged="changed"
      :catalogue="catalogue"
      childForces
      childSelections
    />

    <FilterBy
      v-if="item.field?.startsWith('limit::') == false"
      noshared
      class="section"
      :item="item"
      @catalogueChanged="changed"
      :catalogue="catalogue"
    />
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
  emits: ["catalogueChanged"],
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
  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
  components: { Condition: ConditionVue, FilterBy },
};
</script>

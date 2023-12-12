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
      v-if="item.field.startsWith('limit::') == false"
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
import { BSICondition } from "~/assets/shared/battlescribe/bs_types";
import Condition from "./fields/Condition.vue";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import FilterBy from "./fields/FilterBy.vue";

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
  components: { Condition, FilterBy },
};
</script>

<template>
  <span @change="changed">
    <CatalogueRightPanelFieldsComment :item="item" />
    <CatalogueRightPanelFieldsMessage :item="item" />

    <CatalogueRightPanelFieldsConstraint :catalogue="catalogue" :item="item" class="section" />
    <CatalogueRightPanelFieldsQuery
      :catalogue="catalogue"
      :item="item"
      class="section"
      childForces
      childSelections
      shared
    />
    <FilterBy v-if="showFilterBy" class="section" :item="item" :catalogue="catalogue" />
    <CatalogueRightPanelFieldsQuickModifiers :item="item" :withCategory="false" class="section" />
  </span>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Condition, Constraint } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import QuickModifiers from "./fields/QuickModifiers.vue";
import FilterBy from "./fields/FilterBy.vue";

export default {
  components: { FilterBy, QuickModifiers },

  props: {
    item: {
      type: Object as PropType<Constraint & EditorBase>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
  computed: {
    showFilterBy() {
      return this.item.scope === "self";
    },
  },
  methods: {
    changed() {
      this.catalogue.updateCondition(this.item as EditorBase & Condition);
    },
  },
};
</script>

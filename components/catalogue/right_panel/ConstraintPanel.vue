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
import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import { Base, Condition, Constraint } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import FilterBy from "./fields/FilterBy.vue";
import QuickModifiers from "./fields/QuickModifiers.vue";

export default {
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
      const key = getModifierOrConditionParent(this.item as EditorBase)?.parentKey;
      return key === "associations";
    },
  },
  methods: {
    changed() {
      this.catalogue.updateCondition(this.item as EditorBase & Condition);
    },
  },
  components: { FilterBy, QuickModifiers },
};
</script>

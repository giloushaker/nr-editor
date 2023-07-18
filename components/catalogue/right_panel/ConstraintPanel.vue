<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsConstraint
    :catalogue="catalogue"
    :item="item"
    @catalogueChanged="changed"
    class="section"
  />
  <CatalogueRightPanelFieldsQuery
    :catalogue="catalogue"
    :item="item"
    @catalogueChanged="changed"
    class="section"
    childForces
    childSelections
    shared
  />
  <FilterBy v-if="showFilterBy" class="section" :item="item" @catalogueChanged="changed" :catalogue="catalogue" />
  <CatalogueRightPanelFieldsQuickModifiers
    :item="item"
    @catalogueChanged="changed"
    :withCategory="false"
    class="section"
  />
</template>

<script lang="ts">
import { PropType } from "vue";
import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import { Base, Condition } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import FilterBy from "./fields/FilterBy.vue";
import QuickModifiers from "./fields/QuickModifiers.vue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Base>,
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
      this.$emit("catalogueChanged");
    },
  },
  components: { FilterBy, QuickModifiers },
};
</script>

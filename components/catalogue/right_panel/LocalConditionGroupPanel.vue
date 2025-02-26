<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsRepeat :catalogue="catalogue" :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsCondition class="section" :item="item" @catalogueChanged="changed" :catalogue="catalogue" />
  <CatalogueRightPanelFieldsQuery
    class="section"
    :item="item"
    @catalogueChanged="changed"
    :catalogue="catalogue"
    childForces
    childSelections
  />
  <CatalogueRightPanelFieldsQuickConditions
    :item="item"
    @catalogueChanged="changed"
    :withCategory="false"
    class="section"
  />
</template>

<script lang="ts">
import { Base, LocalConditionGroup } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import { BSILocalConditionGroup } from "~/assets/shared/battlescribe/bs_types";
import NumberInput from "~/components/util/NumberInput.vue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<LocalConditionGroup>,
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
  computed: {
    allowNonInstanceOf() {
      if (this.parent?.editorTypeName === "costType") return false;
      if (this.item.scope === "ancestor") return false;
      return true;
    },
    allowInstanceOf() {
      return false;
    },
    instanceOf() {
      return this.item.type?.includes("instance");
    },
    parent() {
      return getModifierOrConditionParent(this.item as Base as EditorBase);
    },
  },
  components: { NumberInput },
  watch: {
    "item.scope"() {
      const allowed = ["instanceOf", "notInstanceOf"];
      if (!this.allowNonInstanceOf && !allowed.includes(this.item.type)) {
        this.item.type = allowed[0] as BSILocalConditionGroup["type"];
      }
    },
  },
};
</script>

<style scoped>
.condition {
  display: grid;
  grid-template-columns: 1fr 100px max-content;
  align-items: center;
  grid-gap: 5px;
}
</style>

<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsReference
    v-if="type != 'catalogue'"
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
    class="section"
  />

  <CatalogueRightPanelFieldsLink
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
    class="section"
    :type="type"
  />

  <CatalogueRightPanelFieldsCosts
    v-if="item.editorTypeName == 'entryLink' || item.editorTypeName == 'entryGroupLink'"
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
    class="section"
  />

  <CatalogueRightPanelFieldsBooleans
    :item="item"
    @catalogueChanged="changed"
    class="section"
    v-if="type != 'catalogue'"
  >
    Entry
  </CatalogueRightPanelFieldsBooleans>

  <CatalogueRightPanelFieldsQuickConstraints
    :item="item"
    @catalogueChanged="changed"
    :withCategory="false"
    class="section"
    v-if="type == 'entry'"
  >
  </CatalogueRightPanelFieldsQuickConstraints>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Base & EditorBase>,
      required: true,
    },

    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },

    type: {
      type: String,
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

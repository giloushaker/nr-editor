<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics :item="item" @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsReference v-if="type != 'catalogue'" :item="item" :catalogue="catalogue"
    @catalogueChanged="changed" class="section" />

  <CatalogueRightPanelFieldsLink :item="item" :catalogue="catalogue" @catalogueChanged="changed" class="section"
    :type="type" />

  <CatalogueRightPanelFieldsCosts v-if="item.editorTypeName == 'selectionEntryLink'" :item="item" :catalogue="catalogue"
    @catalogueChanged="changed" class="section" />
  <CatalogueRightPanelFieldsCreation v-if="item.editorTypeName == 'selectionEntryLink'" :item="item"
    :catalogue="catalogue" @catalogueChanged="changed" class="section" />

  <CatalogueRightPanelFieldsBooleans :item="item" @catalogueChanged="changed" class="section" v-if="type != 'catalogue'">
    Entry
  </CatalogueRightPanelFieldsBooleans>

  <CatalogueRightPanelFieldsCategories
    v-if="item.editorTypeName == 'selectionEntryLink' || item.editorTypeName == 'selectionEntryGroupLink'" :item="item"
    :catalogue="catalogue" @catalogueChanged="changed" class="section" />

  <CatalogueRightPanelFieldsQuickConstraints :item="item" @catalogueChanged="changed" :withCategory="false"
    class="section" v-if="type == 'entry' || type == 'category'" />

  <CatalogueRightPanelFieldsSortChilds v-if="type == 'entry'" :item="item" :catalogue="catalogue"
    @catalogueChanged="changed" />
</template>

<script lang="ts">
import { PropType } from "vue";
import { Base, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Link & EditorBase>,
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

<template>
  <CatalogueRightPanelFieldsComment :item="item" />
  <CatalogueRightPanelFieldsBasics :item="item" class="section" />
  <CatalogueRightPanelFieldsReference v-if="type != 'catalogue'" :item="item" :catalogue="catalogue" class="section" />

  <CatalogueRightPanelFieldsLink
    :item="item"
    :catalogue="catalogue"
    class="section"
    :type="type"
    @change="linkChanged"
  />

  <CatalogueRightPanelFieldsCosts v-if="isEntry" :item="item" :catalogue="catalogue" class="section" />
  <CatalogueRightPanelFieldsCreation v-if="isEntry" :item="item" :catalogue="catalogue" class="section" />

  <CatalogueRightPanelFieldsBooleans :item="item" class="section" v-if="type != 'catalogue'">
    Entry
  </CatalogueRightPanelFieldsBooleans>

  <CatalogueRightPanelFieldsTracked v-if="type == 'category'" :item="item" class="section" />

  <CatalogueRightPanelFieldsCategories v-if="isEntryOrGroup" :item="item" :catalogue="catalogue" class="section" />

  <CatalogueRightPanelFieldsCharacteristics
    class="mt-10px"
    v-if="item.target?.isProfile()"
    :item="(item.target as EditorBase & Profile)"
    :catalogue="item.target.catalogue"
    link
  />
  <CatalogueRightPanelFieldsAttributes
    class="mt-10px"
    v-if="item.target?.isProfile()"
    :item="(item.target as EditorBase & Profile)"
    :catalogue="item.target.catalogue"
    link
  />
  <CatalogueRightPanelFieldsDescription
    class="section"
    v-if="item.target?.isRule()"
    :item="(item.target as EditorBase & Rule)"
    :catalogue="catalogue"
    link
  />

  <CatalogueRightPanelFieldsQuickConstraints
    :item="item"
    :withCategory="false"
    class="section"
    v-if="type == 'entry' || type == 'categoryEntry'"
  />

  <CatalogueRightPanelFieldsSortChilds
    v-if="isEntryOrGroup"
    :item="item"
    :catalogue="catalogue"
    :get_items="getChilds"
  />
</template>

<script lang="ts">
import { link } from "fs";
import { catalogueProp } from "./fields/props";
import type { PropType } from "vue";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { Link, Profile, Rule } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useSettingsStore } from "~/stores/settingsState";

export default {
  props: {
    item: {
      type: Object as PropType<Link & EditorBase>,
      required: true,
    },

    ...catalogueProp,

    type: {
      type: String,
      required: true,
    },
  },

  setup() {
    return { settings: useSettingsStore() };
  },

  methods: {
    getChilds(item: Link) {
      return sortByAscending([...item.iterateSelectionEntries(), ...item.associationsIterator()], (o) => o.getName());
    },
    linkChanged() {
      if (this.settings.autoRenameInfoLinkParent && this.item.parent) {
        this.item.parent.name = this.item.name;
      }
    },
  },
  computed: {
    isEntryOrGroup() {
      return this.item.editorTypeName == "selectionEntryLink" || this.item.editorTypeName == "selectionEntryGroupLink";
    },
    isGroup() {
      return this.item.editorTypeName == "selectionEntryGroupLink";
    },
    isEntry() {
      return this.item.editorTypeName == "selectionEntryLink";
    },
  },
};
</script>

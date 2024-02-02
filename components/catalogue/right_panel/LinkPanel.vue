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
    @catalogueChanged="linkChanged"
    class="section"
    :type="type"
  />

  <CatalogueRightPanelFieldsCosts
    v-if="isEntry"
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
    class="section"
  />
  <CatalogueRightPanelFieldsCreation
    v-if="isEntry"
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

  <CatalogueRightPanelFieldsCategories
    v-if="isEntryOrGroup"
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
    class="section"
  />

  <CatalogueRightPanelFieldsCharacteristics
    class="mt-10px"
    v-if="item.target?.isProfile()"
    :item="(item.target as EditorBase & Profile)"
    :catalogue="item.target.catalogue"
    link
  />
  <CatalogueRightPanelFieldsQuickConstraints
    :item="item"
    @catalogueChanged="changed"
    :withCategory="false"
    class="section"
    v-if="type == 'entry' || type == 'category'"
  />

  <CatalogueRightPanelFieldsSortChilds
    v-if="isEntryOrGroup"
    :item="item"
    :catalogue="catalogue"
    @catalogueChanged="changed"
  />
</template>

<script lang="ts">
import { PropType } from "vue";
import { Link, Profile } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useSettingsStore } from "~/stores/settingsState";

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

  setup() {
    return { settings: useSettingsStore() };
  },

  methods: {
    linkChanged() {
      if (this.settings.autoRenameInfoLinkParent && this.item.parent) {
        this.item.parent.name = this.item.name;
      }
      this.changed();
    },

    changed() {
      this.$emit("catalogueChanged");
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

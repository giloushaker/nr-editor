<template>
  <div class="rightPanel h-full" v-if="item">
    <template v-if="store.mode === 'edit'">
      <CatalogueRightPanelPublicationPanel
        v-if="item.editorTypeName == 'publication'"
        :item="item"
        @catalogueChanged="changed"
      />

      <CatalogueRightPanelCostTypesPanel
        v-else-if="item.editorTypeName == 'costType'"
        :item="item"
        @catalogueChanged="changed"
      >
      </CatalogueRightPanelCostTypesPanel>

      <CatalogueRightPanelProfileTypesPanel
        v-else-if="item.editorTypeName == 'profileType'"
        :item="item"
        @catalogueChanged="changed"
      >
      </CatalogueRightPanelProfileTypesPanel>

      <CatalogueRightPanelCategoryEntriesPanel
        v-else-if="item.editorTypeName == 'category'"
        :item="item"
        :catalogue="catalogue"
        @catalogueChanged="changed"
      />
      <CatalogueRightPanelForceEntriesPanel
        v-else-if="item.editorTypeName == 'force'"
        :item="item"
        :catalogue="catalogue"
        @catalogueChanged="changed"
      />
      <CatalogueRightPanelProfilesPanel
        v-else-if="item.editorTypeName == 'profile'"
        :item="item"
        :catalogue="catalogue"
        @catalogueChanged="changed"
      />
      <CatalogueRightPanelRulesPanel
        v-else-if="item.editorTypeName == 'rule'"
        :item="item"
        :catalogue="catalogue"
        @catalogueChanged="changed"
      />
      <CatalogueRightPanelSelectionEntryPanel
        v-else-if="item.editorTypeName == 'selectionEntry'"
        :item="item"
        :catalogue="catalogue"
        @catalogueChanged="changed"
      />
      <CatalogueRightPanelLinkPanel
        v-else-if="item.editorTypeName == 'entryLink'"
        :item="item"
        :catalogue="catalogue"
        @catalogueChanged="changed"
      />
      <CatalogueRightPanelModifierPanel
        v-else-if="item.editorTypeName == 'modifier'"
        :item="item"
        :catalogue="catalogue"
        @catalogueChanged="changed"
      />
      <CatalogueRightPanelConstraintPanel
        v-else-if="item.editorTypeName == 'constraint'"
        :item="item"
        :catalogue="catalogue"
        @catalogueChanged="changed"
      />
    </template>
    <template v-else-if="store.mode === 'references'">
      <CatalogueRightPanelReferencesPanel :item="item" :catalogue="catalogue" />
    </template>
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorState";

export default {
  setup() {
    return { store: useEditorStore() };
  },
  emits: ["catalogueChanged"],
  props: {
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
    item() {
      return this.store.get_selected();
    },
  },
};
</script>

<style lang="scss">
.editorTable {
  width: 100%;
  td {
    border: none;
    text-align: left;
    &:first-child {
      white-space: nowrap;
      width: fit-content;
      text-align: right;
    }
    &:last-child {
      width: 100%;
    }
  }

  select,
  input[type="text"] {
    width: 100% !important;
  }
}

.rightPanel {
  overflow-y: auto;
  padding-top: 10px;
  padding-right: 10px;
  padding-left: 5px;
}
</style>

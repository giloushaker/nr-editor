<template>
  <div class="rightPanel" v-if="item" :key="key" @change="store.changed(item)" @changed="store.changed(item)">
    <NodePath :path="path(item)" class="inline p-1px pl-2px" @nodeclick="clicked" />
    <template v-if="store.mode === 'edit'">
      <CatalogueRightPanelPublicationPanel v-if="typeName == 'publication'" :item="item" />

      <CatalogueRightPanelCostTypesPanel v-else-if="typeName == 'costType'" :item="item">
      </CatalogueRightPanelCostTypesPanel>

      <CatalogueRightPanelProfileTypesPanel v-else-if="typeName == 'profileType'" :item="item" />
      <CatalogueRightPanelCharacteristicTypePanel v-else-if="typeName == 'characteristicType' || typeName === 'attributeType'" :item="item" />
      <CatalogueRightPanelCategoryEntriesPanel v-else-if="typeName == 'categoryEntry'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelForceEntriesPanel v-else-if="typeName == 'forceEntry'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelProfilesPanel v-else-if="typeName == 'profile'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelRulesPanel v-else-if="typeName == 'rule'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelSelectionEntryPanel v-else-if="typeName == 'selectionEntry'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelLinkPanel v-else-if="typeName == 'forceEntryLink'" :item="item" :catalogue="catalogue" :type="'force'" />
      <CatalogueRightPanelLinkPanel v-else-if="links.includes(typeName)" :item="item" :catalogue="catalogue" :type="'entry'" />
      <CatalogueRightPanelLinkPanel v-else-if="infoLinks.includes(typeName)" :item="item" :catalogue="catalogue" :type="'info'" />
      <CatalogueRightPanelModifierPanel v-else-if="typeName == 'modifier'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelConstraintPanel v-else-if="typeName == 'constraint'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelConditionGroupPanel v-else-if="typeName == 'conditionGroup'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelConditionPanel v-else-if="typeName == 'condition'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelLocalConditionGroupPanel v-else-if="typeName === 'localConditionGroup'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelLinkPanel v-else-if="typeName == 'categoryLink'" :item="item" :catalogue="catalogue" type="category" />
      <CatalogueRightPanelModifierGroupPanel v-else-if="typeName == 'modifierGroup'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelInfoGroupPanel v-else-if="typeName == 'infoGroup'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelSelectionEntryGroupPanel v-else-if="typeName == 'selectionEntryGroup'" :item="item" :catalogue="catalogue" />
      <CatalogueRightPanelLinkPanel v-else-if="typeName == 'catalogueLink'" :item="item" :catalogue="catalogue" type="catalogue" />
      <CatalogueRightPanelCataloguePanel v-else-if="typeName == 'catalogue' || typeName == 'gameSystem'" :item="item" :catalogue="catalogue" type="catalogue" />
      <CatalogueRightPanelRepeatPanel v-else-if="typeName == 'repeat'" :item="item" :catalogue="catalogue" type="catalogue" />
      <CatalogueRightPanelAssociationPanel v-else-if="typeName == 'association'" :item="item" :catalogue="catalogue" type="catalogue" />

      <div class="min-h-100px"> </div>
    </template>
    <template v-else-if="store.mode === 'references'">
      <CatalogueRightPanelReferencesPanel :item="item" :catalogue="catalogue" />
    </template>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import NodePath from "~/components/util/NodePath.vue";
import { EntryPathEntryExtended, getAtEntryPath, getEntryPathInfo } from "~/assets/shared/battlescribe/bs_editor";
export default {
  components: { NodePath },
  setup() {
    return { store: useEditorStore() };
  },
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
  data() {
    return {
      links: ["link", "entryLink", "selectionEntryLink", "selectionEntryGroupLink", "forceEntryLink"],
      infoLinks: ["infoLink", "profileLink", "ruleLink", "infoGroupLink"],
      key: 0,
    };
  },

  methods: {
    clicked(payload: { path: EntryPathEntryExtended[] }) {
      if (!payload.path.length) return;
      const catalogueId = payload.path[0].id;
      if (!catalogueId) return;
      const catalogue = this.catalogue.findOptionById(catalogueId) as Catalogue | undefined;
      if (!catalogue) {
        notify({ text: `Couldn't find catalogue with id ${catalogueId}`, type: "error" });
        return;
      }
      const node = getAtEntryPath(catalogue, payload.path.slice(1));
      this.store.goto(node);
    },
    path(link: EditorBase) {
      const path = getEntryPathInfo(link);
      return path;
    },
    changed() {
      this.store.changed(this.item || this.catalogue);
    },
  },

  computed: {
    item() {
      return this.store.get_selected();
    },

    typeName() {
      return this.item?.editorTypeName as any as string;
    },
  },
  watch: {
    item() {
      this.key++;
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
  padding-top: 10px;
  padding-right: 10px;
  padding-left: 5px;
}
</style>

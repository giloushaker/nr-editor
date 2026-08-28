<template>
  <div class="rightPanel" v-if="item" @change="store.changed(item)" @changed="store.changed(item)">
    <NodePath :path="path(item)" class="inline p-1px pl-2px" @nodeclick="clicked" />
    <template v-if="store.mode === 'edit'">
      <component v-if="panel" :is="panel" v-bind="panelProps" />
      <div class="min-h-100px"> </div>
    </template>
    <template v-else-if="store.mode === 'references'">
      <CatalogueRightPanelReferencesPanel :item="item" :catalogue="catalogue" />
    </template>
  </div>
</template>

<script lang="ts">
import { catalogueProp } from "./fields/props";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import NodePath from "~/components/util/NodePath.vue";
import { EntryPathEntryExtended, getAtEntryPath, getEntryPathInfo } from "~/assets/editor/bs_editor";

import AssociationLinkPanel from "./AssociationLinkPanel.vue";
import AssociationPanel from "./AssociationPanel.vue";
import CataloguePanel from "./CataloguePanel.vue";
import CategoryEntriesPanel from "./CategoryEntriesPanel.vue";
import CharacteristicTypePanel from "./CharacteristicTypePanel.vue";
import ConditionGroupPanel from "./ConditionGroupPanel.vue";
import ConditionPanel from "./ConditionPanel.vue";
import ConstraintPanel from "./ConstraintPanel.vue";
import CostTypesPanel from "./CostTypesPanel.vue";
import ForceEntriesPanel from "./ForceEntriesPanel.vue";
import InfoGroupPanel from "./InfoGroupPanel.vue";
import LinkPanel from "./LinkPanel.vue";
import LocalConditionGroupPanel from "./LocalConditionGroupPanel.vue";
import ModifierGroupPanel from "./ModifierGroupPanel.vue";
import ModifierPanel from "./ModifierPanel.vue";
import ProfileTypesPanel from "./ProfileTypesPanel.vue";
import ProfilesPanel from "./ProfilesPanel.vue";
import PublicationPanel from "./PublicationPanel.vue";
import RepeatPanel from "./RepeatPanel.vue";
import RulesPanel from "./RulesPanel.vue";
import SelectionEntryGroupPanel from "./SelectionEntryGroupPanel.vue";
import SelectionEntryPanel from "./SelectionEntryPanel.vue";

/**
 * editorTypeName -> panel. `type` is LinkPanel's discriminator; every other panel ignores it.
 * Resolved category links report their target's type + "Link", so both names are listed.
 */
const panels: Record<string, { is: any; type?: string }> = {
  publication: { is: PublicationPanel },
  costType: { is: CostTypesPanel },
  profileType: { is: ProfileTypesPanel },
  characteristicType: { is: CharacteristicTypePanel },
  attributeType: { is: CharacteristicTypePanel },

  categoryEntry: { is: CategoryEntriesPanel },
  forceEntry: { is: ForceEntriesPanel },
  profile: { is: ProfilesPanel },
  rule: { is: RulesPanel },
  selectionEntry: { is: SelectionEntryPanel },
  selectionEntryGroup: { is: SelectionEntryGroupPanel },
  infoGroup: { is: InfoGroupPanel },
  modifier: { is: ModifierPanel },
  modifierGroup: { is: ModifierGroupPanel },
  constraint: { is: ConstraintPanel },
  condition: { is: ConditionPanel },
  conditionGroup: { is: ConditionGroupPanel },
  localConditionGroup: { is: LocalConditionGroupPanel },
  repeat: { is: RepeatPanel },
  association: { is: AssociationPanel },
  associationLink: { is: AssociationLinkPanel },
  catalogue: { is: CataloguePanel },
  gameSystem: { is: CataloguePanel },

  forceEntryLink: { is: LinkPanel, type: "force" },
  link: { is: LinkPanel, type: "entry" },
  entryLink: { is: LinkPanel, type: "entry" },
  selectionEntryLink: { is: LinkPanel, type: "entry" },
  selectionEntryGroupLink: { is: LinkPanel, type: "entry" },
  infoLink: { is: LinkPanel, type: "info" },
  profileLink: { is: LinkPanel, type: "info" },
  ruleLink: { is: LinkPanel, type: "info" },
  infoGroupLink: { is: LinkPanel, type: "info" },
  categoryLink: { is: LinkPanel, type: "category" },
  categoryEntryLink: { is: LinkPanel, type: "category" },
  catalogueLink: { is: LinkPanel, type: "catalogue" },
};

/** These declare `item` only; passing a catalogue would leak onto their root element. */
const itemOnly = new Set(["publication", "costType", "profileType", "characteristicType", "attributeType"]);

export default {
  components: { NodePath },
  setup() {
    return { store: useEditorStore() };
  },
  props: {
    ...catalogueProp,
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

    panel() {
      return panels[this.typeName]?.is;
    },

    panelProps() {
      const entry = panels[this.typeName];
      return {
        item: this.item,
        ...(itemOnly.has(this.typeName) ? {} : { catalogue: this.catalogue }),
        ...(entry?.type ? { type: entry.type } : {}),
      };
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
  fieldset {
    min-inline-size: 0;
  }

  padding-top: 10px;
  padding-right: 10px;
  padding-left: 5px;
}
</style>

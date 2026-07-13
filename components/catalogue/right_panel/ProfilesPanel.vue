<template>
  <CatalogueRightPanelFieldsComment :item="item" class="section" />
  <CatalogueRightPanelFieldsBasics :item="item" class="section" aliases />
  <CatalogueRightPanelFieldsReference :item="item" :catalogue="catalogue" class="section" />
  <CatalogueRightPanelFieldsHidden :item="item" class="section">
    Constraints
  </CatalogueRightPanelFieldsHidden>

  <!-- NR extension: exclusive-selection profiles (one selected per selectionGroup in the army builder). -->
  <fieldset class="section">
    <legend>Selection</legend>
    <div class="mr-8px">
      <table class="editorTable">
        <tr>
          <td class="hastooltip" title="Shows a checkbox next to this profile in the army builder; only one profile per Selection Group can be selected, and this profile's modifiers are disabled while it is not selected.">Selectable</td>
          <td><input type="checkbox" v-model="selectable" /></td>
        </tr>
        <tr v-if="selectable">
          <td class="hastooltip" title="Profiles sharing the same group are mutually exclusive (the first one is selected by default).">Selection Group</td>
          <td><input type="text" v-model="selectionGroup" placeholder="selection" /></td>
        </tr>
      </table>
    </div>
  </fieldset>

  <CatalogueRightPanelFieldsCharacteristics class="section" :item="item" :catalogue="catalogue" />
  <CatalogueRightPanelFieldsAttributes class="section" :item="item" :catalogue="catalogue" />
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIProfile } from "~/assets/shared/battlescribe/bs_types";

export default {
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    item: {
      type: Object as PropType<BSIProfile>,
      required: true,
    },
  },
  computed: {
    // Delete-on-default so untouched profiles keep serializing byte-identical (legacy BattleScribe safe).
    selectable: {
      get(): boolean {
        return Boolean(this.item.selectable);
      },
      set(checked: boolean) {
        if (checked) {
          this.item.selectable = true;
        } else {
          delete this.item.selectable;
          delete this.item.selectionGroup;
        }
      },
    },
    // Empty or the default "selection" is not stored.
    selectionGroup: {
      get(): string {
        return this.item.selectionGroup ?? "";
      },
      set(value: string) {
        const trimmed = value.trim();
        if (!trimmed || trimmed === "selection") {
          delete this.item.selectionGroup;
        } else {
          this.item.selectionGroup = trimmed;
        }
      },
    },
  },
};
</script>

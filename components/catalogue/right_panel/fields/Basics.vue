<template>
  <fieldset>
    <legend>Basics</legend>
    <div class="mr-8px">
      <table class="editorTable">
        <!-- The id isn't a plain field write: it has to move the node in the catalogue index. -->
        <tr>
          <td>Unique ID:</td>
          <td class="flex gap-2px">
            <input type="text" v-model="id" @change="idchanged" class="flex flex-shrink" />
            <button class="btn !w-34px flex items-center" @click="refresh">
              <span>
                <img class="h-20px w-20px icon" src="/assets/icons/back.png" title="Generate Id" />
              </span>
            </button>
          </td>
        </tr>

        <EditorField :item="item" field="name" label="Name">
          <div class="flex gap-2px items-center">
            <EditorFieldControl :item="item" field="name" />
            <template v-if="sortable">
              <span>Position:</span>
              <EditorFieldControl :item="item" field="sortIndex" type="number" class="w-50px inline-block" />
            </template>
          </div>
        </EditorField>

        <EditorField
          v-if="item.editorTypeName === 'forceEntry'"
          :item="item"
          field="childForcesLabel"
          label="Child Forces Label"
          placeholder="Forces"
        />

        <template v-if="aliases">
          <EditorField
            :item="item"
            field="alias"
            label="Aliases"
            title="Additional Aliases for in-text reference matching, case insensitive.&#10;one per line"
          >
            <InputStringArray v-model="item.alias" />
          </EditorField>
          <EditorField
            :item="item"
            field="noindex"
            type="checkbox"
            label="No Index"
            title="Disable indexing the name of this node for in-text references."
          />
        </template>
      </table>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import InputStringArray from "./InputStringArray.vue";
import EditorField from "./EditorField.vue";
import EditorFieldControl from "./EditorFieldControl.vue";
import { itemProp } from "./props";
import { useEditorStore } from "~/stores/editorStore";

export default {
  components: { InputStringArray, EditorField, EditorFieldControl },
  setup() {
    return { store: useEditorStore() };
  },
  props: {
    ...itemProp,
    aliases: {
      type: Boolean,
      default: false,
    },
  },

  methods: {
    /**
     * Marks the catalogue unsaved. These edits deliberately bypass store.set_field -- the id
     * has to move the node in the index, min/max are raw v-model, categories mutate a links
     * array -- and set_field is what otherwise reports the change, so without this the edit
     * lands but the save indicator never lights up. Was calling a `changed()` that no
     * component defined, so it threw.
     */
    changed() {
      this.store.changed(this.item as EditorBase);
    },
    idchanged() {
      this.changed();
    },
    refresh() {
      this.id = generateBattlescribeId();
      this.idchanged();
    },
  },
  computed: {
    id: {
      get(): string {
        return this.item.id;
      },
      set(id: string) {
        const obj = this.item as EditorBase;
        const catalogue = obj.getCatalogue();
        catalogue.removeFromIndex(obj);
        obj.id = id;
        catalogue.addToIndex(obj);
      },
    },
    typeName() {
      return (this.item as EditorBase).editorTypeName;
    },
    sortable() {
      return [
        "forceEntry",
        "forceEntryLink",
        "selectionEntry",
        "selectionEntryGroup",
        "selectionEntryLink",
        "selectionEntryGroupLink",
        "association",
        "associationLink",
      ].includes(this.typeName);
    },
  },
};
</script>
<style>
.btn {
  border: 1px solid var(--box-border, #aaa);
  background-color: var(--input-background);
  box-shadow: 2px 2px 5px -2px var(--box-border, #aaa);
}
</style>

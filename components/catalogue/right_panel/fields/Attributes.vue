<template>
  <fieldset v-if="attributes?.length">
    <legend>Attributes<span class="gray" v-if="link"> (from target)</span></legend>
    <table class="editorTable">
      <tr v-for="char of attributes">
        <td>{{ char.name }}: </td>
        <td>
          <UtilEditableDiv v-model="char.$text" @change="changed" />
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { getName, getNameExtra } from "~/assets/editor/bs_editor";
import { Link, Profile, ProfileType } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import { useSettingsStore } from "~/stores/settingsState";

export default {
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    item: {
      type: Object as PropType<Profile>,
      required: true,
    },
    link: {
      type: Boolean,
    },
  },
  setup() {
    return { settings: useSettingsStore(), store: useEditorStore() };
  },
  methods: {
    getName,
    getNameExtra,
    changedType(newType: ProfileType & EditorBase, oldOption: ProfileType & EditorBase): void {
      this.item.getCatalogue().refreshErrors(this.item as EditorBase & (Profile | Link<Profile>));

      // typeId is a reference the index derives, so reindexing covers both the old
      // and the new profile type.
      this.item.getCatalogue().reindexReferences(this.item as EditorBase);
      this.item.attributes = this.attributes;
    },

    changed(): void {
      this.store.edit_node(this.item as Profile & EditorBase, { attributes: this.attributes });
    },
  },

  computed: {
    profileTypes() {
      return [...this.catalogue.iterateProfileTypes()];
    },

    attributes() {
      const existing = {} as Record<string, any>;
      for (const c of this.item.attributes || []) {
        existing[c.name] = c.$text;
      }
      if (!this.item.typeId) return [];
      const type = this.catalogue.findOptionById(this.item.typeId) as ProfileType;
      if (!this.item.isLink()) {
        this.item.typeName = type?.name;
      }

      const result = type?.attributeTypes?.map((elt) => ({
        name: elt.name,
        typeId: elt.id,
        $text: existing[elt.name] || "",
      }));
      return result;
    },
  },
};
</script>

<style scoped></style>

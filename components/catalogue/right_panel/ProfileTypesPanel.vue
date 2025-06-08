<template>
  <CatalogueRightPanelFieldsComment :item="item" @catalogueChanged="changed" />
  <CatalogueRightPanelFieldsBasics
    :item="item"
    @catalogueChanged="changed"
    class="section"
    @namechanged="profileNameChanged"
    @idchanged="profileIdChanged"
  />
  <CatalogueRightPanelFieldsProfileType class="section" :item="item" @catalogueChanged="changed" />
</template>

<script lang="ts">
import { PropType } from "vue";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIProfile, BSIProfileType } from "~/assets/shared/battlescribe/bs_types";
import { useEditorStore } from "~/stores/editorStore";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIProfileType>,
      required: true,
    },
  },
  setup() {
    return { store: useEditorStore() };
  },
  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
    profileNameChanged() {
      const refs = (this.item as BSIProfileType & EditorBase).refs || [];
      for (const ref of refs as (BSIProfile & EditorBase)[]) {
        if (ref.typeId === this.item.id) {
          ref.typeName = this.item.name;
          this.store.set_catalogue_changed(ref.catalogue);
        }
      }
      this.$emit("catalogueChanged");
    },
    profileIdChanged() {
      const refs = (this.item as BSIProfileType & EditorBase).refs || [];
      for (const ref of refs as (BSIProfile & EditorBase)[]) {
        if (ref.typeName === this.item.name) {
          ref.typeId = this.item.id;
          this.store.set_catalogue_changed(ref.catalogue);
        }
      }
      this.$emit("catalogueChanged");
    },
  },
};
</script>

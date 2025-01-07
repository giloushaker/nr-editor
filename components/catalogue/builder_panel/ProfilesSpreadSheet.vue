<template>
  <fieldset>
    <legend class="bold">Profiles</legend>
    <div v-for="type in types">
      <table>
        <tr>
          <th class="bold">{{ type.getName() }}</th>
          <th v-for="c in type.characteristicTypes || []">
            {{ c.name }}
          </th>
        </tr>
        <tr v-for="existing in profiles[type.getName()] || []">
          <UtilEditableDiv class="data" is="td" v-model="existing.name" />

          <template v-for="c in existing.characteristics">
            <UtilEditableDiv class="data" is="td" v-model="c.$text" />
          </template>
        </tr>
        <tr>
          <UtilEditableDiv is="td" :placeholder="item.getName()" />
          <template v-for="c in type.characteristicTypes">
            <UtilEditableDiv class="data" is="td" :placeholder="type.default" />
          </template>
        </tr>
      </table>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { groupBy } from "~/assets/shared/battlescribe/bs_helpers";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";

export default {
  setup() {
    return { store: useEditorStore() };
  },
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    item: {
      type: Object as PropType<EditorBase>,
      required: true,
    },
  },
  methods: {
    changed() {
      this.store.changed(this.item || this.catalogue);
    },
  },

  computed: {
    types() {
      return [...this.catalogue.iterateProfileTypes()];
    },
    profiles() {
      if (!this.item) return {};
      return groupBy([...this.item.profilesIterator()], (o) => o.getTypeName());
    },
  },
};
</script>
<style scoped lang="scss"></style>

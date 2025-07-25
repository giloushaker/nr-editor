<template>
  <div :key="key" class="builderPanel">
    <fieldset v-if="forces.length">
      <legend class="bold">Forces</legend>
      <div class="hover-darken clickable" v-for="force in forces" @click="store.goto(force)">
        {{ force.getName() }}
      </div>
    </fieldset>
    <fieldset v-if="entries.length">
      <legend class="bold">Entries</legend>
      <div class="hover-darken clickable" v-for="entry in entries" @click="store.goto(entry)">
        {{ entry.getName() }}
      </div>
    </fieldset>
    <fieldset v-if="categories.length">
      <legend class="bold">categories</legend>
      <div class="hover-darken clickable" v-for="category in categories">
        {{ category.getName() }}
      </div>
    </fieldset>
    <ProfilesSpreadSheet :catalogue="catalogue" :item="item" v-if="item && item.isEntry()" />
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import ProfilesSpreadSheet from "./ProfilesSpreadSheet.vue";
export default {
  components: { ProfilesSpreadSheet },
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
  data() {
    return {
      links: ["link", "selectionEntryLink", "selectionEntryGroupLink"],
      infoLinks: ["infoLink", "profileLink", "ruleLink", "infoGroupLink"],
      key: 0,
    };
  },

  methods: {
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
    forces() {
      if (!this.item) return [];
      return [...this.item.forcesEntriesIterator()];
    },
    entries() {
      if (!this.item) return [];
      return [...this.item.entriesIterator()];
    },
    categories() {
      if (!this.item) return [];
      if (!this.item.isCatalogue() || !this.item.categories) return [];
      return this.item.categories;
    },
  },
  watch: {
    item() {
      this.key++;
    },
  },
};
</script>
<style scoped lang="scss">
.builderPanel {
  padding-top: 10px;
  padding-right: 10px;
  padding-left: 5px;
}
</style>

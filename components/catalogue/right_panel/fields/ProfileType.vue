<template>
  <fieldset class="section">
    <legend>Profile Kind</legend>
    <div class="mr-8px">
      <table class="editorTable">
        <tr>
          <td>Kind:</td>
          <td class="flex gap-2px">
            <select v-model="item.kind">
              <option :value="undefined">Not defined</option>
              <option value="model">Model stats</option>
              <option value="weapon">Weapon</option>
              <option value="spell">Spell</option>
              <option value="ability">Ability</option>
              <option value="rule">Rule</option>
              <option value="tag">Tag</option>
            </select>
          </td>
        </tr>
      </table>
    </div>
  </fieldset>
  <fieldset class="section">
    <legend> Profiles Order </legend><button class="bouton inline" @click="orderPopup = true">Change</button>
  </fieldset>
  <PopupDialog v-if="orderPopup" v-model="orderPopup">
    <div class="text-center">Drag & Drop to change profileTypes order</div>
    <SortOrder :items="get_profile_types()" :get="get" :set="set" :del="del_sort" :autosort="false">
      <template #item="{ item }">{{ item.name }}</template>
    </SortOrder>
  </PopupDialog>
</template>

<script lang="ts">
import { BSIProfileType } from "~/assets/shared/battlescribe/bs_types";
import { PropType } from "vue";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import SortOrder from "./SortOrder.vue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
export default {
  props: {
    item: {
      type: Object as PropType<BSIProfileType & EditorBase>,
      required: true,
    },
  },
  data() {
    return {
      orderPopup: false,
    };
  },
  setup() {
    return { store: useEditorStore() };
  },
  methods: {
    get(item: BSIProfileType & EditorBase) {
      return item.sortIndex;
    },
    set(item: BSIProfileType & EditorBase, v: number) {
      item.sortIndex = v;
      this.store.set_catalogue_changed(item.catalogue, true);
    },
    del_sort(item: BSIProfileType & EditorBase) {
      delete item.sortIndex;
      this.store.set_catalogue_changed(item.catalogue, true);
    },
    get_profile_types() {
      const files = ((this.item as any as EditorBase).catalogue.manager as GameSystemFiles).getAllLoadedCatalogues();
      const found = [];
      for (const file of files) {
        for (const profileType of file.profileTypes || []) {
          found.push(profileType);
        }
      }
      return found as Array<BSIProfileType & EditorBase>;
    },
  },
  components: { SortOrder },
};
</script>
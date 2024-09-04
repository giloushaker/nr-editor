<template>
  <span>
    <fieldset>
      <legend> Order </legend><button class="bouton inline" @click="orderPopup = true">Change</button>
    </fieldset>
    <fieldset>
      <legend>Profil Type</legend>
      <h3>Characteristic Types</h3>
      <div>
        <select size="2" v-model="selected">
          <option :value="t.id" v-for="t of item.characteristicTypes">
            {{ t.name }}
          </option>
        </select>
        <div class="section add">
          <button class="bouton" @click="add"> <img src="/assets/icons/iconeplus.png" /> Add </button>
          <button class="bouton" @click="del"> <img src="/assets/icons/trash.png" /> Delete </button>
        </div>

        <template v-if="selectedType">
          <h3 class="section">Selected Characteristic Type</h3>
          <table class="editorTable">
            <tr>
              <td>Unique Id:</td>
              <td>
                <input type="text" v-model="selectedType.id" @change="characteristicIdChanged(selectedType)" />
              </td>
            </tr>
            <tr>
              <td>Name:</td>
              <td>
                <input type="text" v-model="selectedType.name" @change="characteristicNameChanged(selectedType)" />
              </td>
            </tr>
          </table>
        </template>
      </div>
    </fieldset>
    <PopupDialog v-if="orderPopup" v-model="orderPopup">
      <div class="text-center">Drag & Drop to change profileTypes order</div>
      <SortOrder :items="get_profile_types()" :get="get" :set="set" :del="del_sort" :autosort="false">
        <template #item="{ item }">{{ item.name }}</template>
      </SortOrder>
    </PopupDialog>
  </span>
</template>

<script lang="ts">
import { generateBattlescribeId, replaceKey } from "~/assets/shared/battlescribe/bs_helpers";
import { BSICharacteristicType, BSIProfile, BSIProfileType } from "~/assets/shared/battlescribe/bs_types";
import { PropType } from "vue";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import SortOrder from "./SortOrder.vue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIProfileType>,
      required: true,
    },
  },
  data() {
    return {
      selectedType: null as BSICharacteristicType | null,
      orderPopup: false,
    };
  },
  setup() {
    return { store: useEditorStore() };
  },
  computed: {
    selected: {
      set(id: string | null) {
        this.selectedType = this.item.characteristicTypes.find((o) => o.id === id) || null;
      },
      get(): string | null {
        return this.selectedType?.id || null;
      },
    },
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
    async add() {
      const type = await this.store.create_node("characteristicTypes", this.item);
      const refs = (this.item as BSIProfileType & EditorBase).refs || [];
      for (const profile of refs) {
        if (profile.isProfile() && !profile.isLink()) {
          if (profile.typeId === this.item.id) {
            if (!profile.characteristics) profile.characteristics = [];
            profile.characteristics.push({ typeId: type.id, name: type.name, $text: "" });
          }
        }
      }
      this.$emit("catalogueChanged");
    },
    del() {
      const type = this.selectedType;
      if (type) {
        this.store.del_node(type);
      }
      const refs = (this.item as BSIProfileType & EditorBase).refs || [];
      for (const ref of refs) {
        for (const profile of ref.profilesIterator()) {
          if (profile.typeId === this.item.id) {
            if (profile.characteristics) {
              profile.characteristics = profile.characteristics.filter((o) => o.typeId !== type.id);
            }
          }
        }
      }
      this.$emit("catalogueChanged");
    },
    characteristicIdChanged(type: BSICharacteristicType) {
      const refs = (this.item as BSIProfileType & EditorBase).refs || [];
      for (const ref of refs as (BSIProfile & EditorBase)[]) {
        if (ref.typeId === this.item.id) {
          for (const char of ref.characteristics || []) {
            if (char.name == type.name) {
              char.typeId = type.id;
              this.store.set_catalogue_changed(ref.catalogue);
            }
          }
        }
      }
      this.$emit("catalogueChanged");
    },
    characteristicNameChanged(type: BSICharacteristicType) {
      const refs = (this.item as BSIProfileType & EditorBase).refs || [];
      for (const ref of refs as (BSIProfile & EditorBase)[]) {
        if (ref.typeId === this.item.id) {
          for (const char of ref.characteristics || []) {
            if (char.typeId == type.id) {
              char.name = type.name;
              this.store.set_catalogue_changed(ref.catalogue);
            }
          }
        }
      }
      this.$emit("catalogueChanged");
    },
    init() {
      if (this.item.characteristicTypes?.length) {
        this.selectedType = this.item.characteristicTypes[0];
      }
    },
  },
  created() {
    this.init();
  },
  watch: {
    item() {
      this.init();
    },
  },
  components: { SortOrder },
};
</script>

<style scoped lang="scss">
select {
  width: 100%;
  height: 300px;
}

h3 {
  font-size: 16px;
}

.add {
  display: grid;
  grid-gap: 10px;
  grid-auto-flow: column;
  grid-template-columns: 1fr min-content;
  justify-items: end;
}
</style>

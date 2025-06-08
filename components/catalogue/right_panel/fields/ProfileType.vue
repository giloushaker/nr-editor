<template>
  <div>
    <fieldset class="section">
      <legend> Profiles Order </legend><button class="bouton inline" @click="orderPopup = true">Change</button>
    </fieldset>

    <template v-if="selectedType">
      <fieldset class="section">
        <legend>Selected Type</legend>
        <table class="editorTable">
          <tr>
            <td>Unique Id:</td>
            <td>
              <input type="text" v-model="selectedType.id" @change="typeIdChanged(selectedType)" />
            </td>
          </tr>
          <tr>
            <td>Name:</td>
            <td>
              <input type="text" v-model="selectedType.name" @change="typeNameChanged(selectedType)" />
            </td>
          </tr>
        </table>
      </fieldset>
    </template>

    <fieldset class="section">
      <legend>Profil Type</legend>
      <h3>Characteristic Types</h3>
      <div>
        <select size="2" v-model="selected" class="multiple">
          <option :value="t.id" v-for="t of item.characteristicTypes">
            {{ t.name }}
          </option>
        </select>
        <div class="section add">
          <button class="bouton" @click="add_characteristic"> <img src="/assets/icons/iconeplus.png" /> Add </button>
          <button class="bouton" @click="del_characteristic"> <img src="/assets/icons/trash.png" /> Delete </button>
        </div>
      </div>
      <h3
        >Attribute Types
        <img src="/assets/icons/i.png" class="align-text-bottom clickable hover-darken" @click="attributesPopup = true"
      /></h3>
      <div>
        <select size="2" v-model="selected" class="multiple">
          <option :value="t.id" v-for="t of item.attributeTypes">
            {{ t.name }}
          </option>
        </select>
        <div class="section add">
          <button class="bouton" @click="add_attribute"> <img src="/assets/icons/iconeplus.png" /> Add </button>
          <button class="bouton" @click="del_attribute"> <img src="/assets/icons/trash.png" /> Delete </button>
        </div>
      </div>
    </fieldset>
    <PopupDialog v-if="orderPopup" v-model="orderPopup">
      <div class="text-center">Drag & Drop to change profileTypes order</div>
      <SortOrder :items="get_profile_types()" :get="get" :set="set" :del="del_sort" :autosort="false">
        <template #item="{ item }">{{ item.name }}</template>
      </SortOrder>
    </PopupDialog>
    <PopupDialog v-if="attributesPopup" v-model="attributesPopup">
      <p class="mt-20px">
        Attributes are similar to characteristics except they will not display in the builder; they will only be usable
        in scripts or export templates.
      </p>
    </PopupDialog>
  </div>
</template>

<script lang="ts">
import { generateBattlescribeId, replaceKey } from "~/assets/shared/battlescribe/bs_helpers";
import { BSICharacteristicType, BSIProfile, BSIProfileType } from "~/assets/shared/battlescribe/bs_types";
import { PropType } from "vue";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import SortOrder from "./SortOrder.vue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { BSIAttributeType } from "~/assets/shared/battlescribe/bs_types";
export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIProfileType & EditorBase>,
      required: true,
    },
  },
  data() {
    return {
      selectedType: null as ((BSICharacteristicType | BSIAttributeType) & EditorBase) | null,
      orderPopup: false,
      attributesPopup: false,
    };
  },
  setup() {
    return { store: useEditorStore() };
  },
  computed: {
    selected: {
      set(id: string | null) {
        this.selectedType =
          (this.item.characteristicTypes?.find((o) => o.id === id) as EditorBase) ||
          (this.item.attributeTypes?.find((o) => o.id === id) as EditorBase) ||
          null;
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
    async add_characteristic() {
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
    del_characteristic() {
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
    async add_attribute() {
      const type = await this.store.create_node("attributeTypes", this.item);
      const refs = (this.item as BSIProfileType & EditorBase).refs || [];
      for (const profile of refs) {
        if (profile.isProfile() && !profile.isLink()) {
          if (profile.typeId === this.item.id) {
            if (!profile.attributes) profile.attributes = [];
            profile.attributes.push({ typeId: type.id, name: type.name, $text: "" });
          }
        }
      }
      this.$emit("catalogueChanged");
    },
    del_attribute() {
      const type = this.selectedType;
      if (type) {
        this.store.del_node(type);
      }
      const refs = (this.item as BSIProfileType & EditorBase).refs || [];
      for (const ref of refs) {
        for (const profile of ref.profilesIterator()) {
          if (profile.typeId === this.item.id) {
            if (profile.attributes) {
              profile.attributes = profile.attributes.filter((o) => o.typeId !== type.id);
            }
          }
        }
      }
      this.$emit("catalogueChanged");
    },
    typeIdChanged(type: BSICharacteristicType | BSIAttributeType) {
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
    typeNameChanged(type: BSICharacteristicType | BSIAttributeType) {
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
      } else if (this.item.attributeTypes?.length) {
        this.selectedType = this.item.attributeTypes[0];
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
  height: 200px;
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

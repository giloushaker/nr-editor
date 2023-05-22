<template>
  <fieldset>
    <legend>Characteristics</legend>
    <table class="editorTable">
      <tr v-if="catalogue.profileTypes">
        <td>Profile Type: </td>
        <td>
          <select v-model="item.typeId" @change="changed">
            <option :value="ptype.id" v-for="ptype of catalogue.profileTypes">
              {{ ptype.name }}
            </option>
          </select>
        </td>
      </tr>
    </table>
    <table class="editorTable">
      <tr v-for="char of item.characteristics">
        <td>{{ char.name }}: </td>
        <td><UtilEditableDiv v-model="char.$text" @change="changed" /></td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICharacteristic, BSIProfile } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
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

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },

  computed: {
    selectedCharacteristics() {
      let type = this.catalogue.profileTypes?.find((type) => type.id === this.item.typeId);
      if (type) {
        return type.characteristicTypes;
      }
      return [];
    },
  },

  watch: {
    "item.typeId"() {
      this.item.characteristics = this.selectedCharacteristics.map((elt) => {
        let res: BSICharacteristic = {
          name: elt.name,
          typeId: elt.id,
          $text: "",
        };
        return res;
      });
    },
  },
};
</script>

<style scoped></style>

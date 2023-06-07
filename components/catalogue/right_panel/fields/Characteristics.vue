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
      <tr v-for="char of charactacteristics">
        <td>{{ char.name }}: </td>
        <td><UtilEditableDiv v-model="char.$text" @change="changed" /></td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { ProfileType } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIProfile } from "~/assets/shared/battlescribe/bs_types";

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
    charactacteristics() {
      const existing = {} as Record<string, any>;
      for (const c of this.item.characteristics || []) {
        existing[c.name] = c.$text;
      }
      const type = this.catalogue.findOptionById(this.item.typeId) as ProfileType;

      const result = type?.characteristicTypes?.map((elt) => ({
        name: elt.name,
        typeId: elt.id,
        $text: existing[elt.name] || "",
      }));
      this.item.characteristics = result;
      return result;
    },
  },
};
</script>

<style scoped></style>

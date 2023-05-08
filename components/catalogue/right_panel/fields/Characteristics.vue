<template>
  <fieldset>
    <legend>Characteristics</legend>
    <table class="editorTable">
      <tr v-if="catalogue.profileTypes">
        <td>Profile Type</td>
        <select v-model="item.typeId">
          <option :value="ptype.id" v-for="ptype of catalogue.profileTypes">
            {{ ptype.name }}
          </option>
        </select>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
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
};
</script>

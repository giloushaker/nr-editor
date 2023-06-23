<template>
  <fieldset>
    <legend>Catalogue</legend>
    <input type="checkbox" v-model="item.library" @change="changed" id="library" />
    <label
      class="hastooltip"
      for="library"
      title="indicates that this catalogue is used to store data, no forces may be created from it if true."
      >Library</label
    >
  </fieldset>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Catalogue>,
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

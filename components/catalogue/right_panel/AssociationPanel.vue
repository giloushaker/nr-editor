<template>
  <div>
    <p class="info">
      Associations are a New Recruit specific feature allowing you to associate an entry to another, such as a unit to a
      bataillon.
      <br />
      Be aware that associations are currently in the beta phase and may undergo modifications.
      <br />
      Feel free to offer feedback or ask questions on our <a href="https://discord.gg/cCtqGbugwb">Discord server</a>.
    </p>
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIRepeat } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIRepeat>,
      required: true,
    },
    catalogue: {
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

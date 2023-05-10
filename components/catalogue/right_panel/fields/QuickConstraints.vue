<template>
  <fieldset>
    <legend>Quick Constraints</legend>
    <div class="columns">
      <div class="buttonList">
        <button class="bouton">
          <img src="/assets/icons/iconeplus.png" />MIN IN PARENT
        </button>
        <button class="bouton" v-if="withCategory">
          <img src="/assets/icons/iconeplus.png" />MIN IN CATEGORY
        </button>
        <button class="bouton">
          <img src="/assets/icons/iconeplus.png" />MIN IN FORCE
        </button>
        <button class="bouton">
          <img src="/assets/icons/iconeplus.png" />MIN IN ROSTER
        </button>
      </div>
      <div class="buttonList">
        <button class="bouton">
          <img src="/assets/icons/iconeplus.png" />MAX IN PARENT
        </button>
        <button class="bouton" v-if="withCategory">
          <img src="/assets/icons/iconeplus.png" />MAX IN CATEGORY
        </button>
        <button class="bouton">
          <img src="/assets/icons/iconeplus.png" />MAX IN FORCE
        </button>
        <button class="bouton">
          <img src="/assets/icons/iconeplus.png" />MAX IN ROSTER
        </button>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { ItemTypes } from "../../left_panel/components/CatalogueEntry.vue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<ItemTypes>,
      required: true,
    },

    withCategory: {
      type: Boolean,
      default: false,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
};
</script>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 10px;
}

.bouton {
  width: 100%;
}

.buttonList {
  display: grid;
  grid-gap: 10px;
}
</style>

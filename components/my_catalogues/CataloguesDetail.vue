<template>
  <div class="details">
    <h4>{{ catalogue.name }}</h4>
    <div>Details of the catalogue</div>
    <div>Go here</div>
    <div>and there...</div>

    <button class="bouton">Edit Catalogue</button>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";
import { NamedItem } from "../IconContainer.vue";

export default {
  props: {
    catalogue: {
      type: Object as PropType<NamedItem>,
      required: true,
    },
  },
};
</script>

<style scoped lang="scss">
.details {
  min-width: 500px;
  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: bold;
  }
}
</style>

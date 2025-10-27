<template>
  <fieldset>
    <legend>Description<span class="gray" v-if="link"> (from target)</span></legend>
    <UtilEditableDiv v-model="item.description" />
  </fieldset>
</template>

<script lang="ts">
export default {
  props: {
    item: {
      type: Object as PropType<{ description: string }>,
      required: true,
    },
    link: {
      type: Boolean,
    },
  },
};
</script>

<template>
  <fieldset>
    <legend>Description<span class="gray" v-if="link"> (from target)</span></legend>
    <UtilEditableDiv v-model="item.description" @change="changed"></UtilEditableDiv>
  </fieldset>
</template>

<script lang="ts">
export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<{ description: string }>,
      required: true,
    },
    link: {
      type: Boolean,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
};
</script>

<template>
  <fieldset>
    <legend><slot /></legend>
    <table class="editorTable">
      <tr>
        <td>Type:</td>
        <td>
          <select v-model="item.type" @change="changed">
            <option value="model">Model</option>
            <option value="upgrade">Upgrade</option>
            <option value="unit">Unit</option>
            <option value="mount">Mount</option>
            <option value="crew">Crew</option>
          </select>
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<{
        type: "model" | "unit" | "upgrade" | "mount" | "crew";
      }>,
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

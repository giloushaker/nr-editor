<template>
  <fieldset>
    <legend>Creation</legend>
    <table class="editorTable">
      <tr>
        <td>Default Amount:</td>
        <td>
          <input
            class="input"
            type="number"
            v-model="item.defaultAmount"
            @change="changed"
            :placeholder="placeholder"
          />
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
        defaultAmount?: number;
        isLink(): boolean;
        getDefaultAmount(): number | undefined;
      }>,
      required: true,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
  computed: {
    placeholder(): string {
      return `${this.item.isLink() ? this.item.getDefaultAmount() || "unset" : "unset"}`;
    },
  },
};
</script>
<style scoped>
.input {
  max-width: 100px;
}
</style>

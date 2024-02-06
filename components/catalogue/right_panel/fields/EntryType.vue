<template>
  <fieldset>
    <legend>
      <slot />
    </legend>
    <table class="editorTable">
      <tr>
        <td>Type:</td>
        <td>
          <select v-model="type" @change="changed">
            <option value="model">Model</option>
            <option value="upgrade">Upgrade</option>
            <option value="unit">Unit</option>
            <option value="unit-group">Unit Group</option>
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
        type: "model" | "unit" | "upgrade";
        subType?: "mount" | "crew" | "unit-group";
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
    type: {
      get() {
        return this.item.subType ?? this.item.type
      },
      set(val: "model" | "unit" | "upgrade" | "mount" | "crew" | "unit-group") {
        switch (val) {
          case "model":
          case "upgrade":
          case "unit":
            this.item.type = val;
            delete this.item.subType;
            break;
          default:
          case "unit-group":
            this.item.type = "unit";
            this.item.subType = val;
            break;
          case "mount":
          case "crew":
            this.item.type = "model";
            this.item.subType = val;
            break;
        }
      }
    }
  }
};
</script>

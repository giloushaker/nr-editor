<template>
  <fieldset>
    <legend>Profil Type</legend>
    <h3>Characteristic Types:</h3>
    <div>
      <select size="2" v-model="selectedType">
        <option :value="type" v-for="type of item.characteristicTypes">
          {{ type.name }}
        </option>
      </select>
    </div>
  </fieldset>
</template>

<script lang="ts">
import {
  BSICharacteristicType,
  BSIProfileType,
} from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIProfileType>,
      required: true,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },

    init() {
      if (this.item.characteristicTypes?.length) {
        this.selectedType = this.item.characteristicTypes[0];
        console.log(this.selectedType);
      }
    },
  },

  data() {
    return {
      selectedType: null as BSICharacteristicType | null,
    };
  },

  created() {
    this.init();
  },

  watch: {
    item() {
      this.init();
    },
  },
};
</script>

<style scoped lang="scss">
select {
  width: 100%;
  height: 300px;
}
</style>

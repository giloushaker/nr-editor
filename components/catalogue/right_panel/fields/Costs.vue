<template>
  <fieldset>
    <legend>Costs</legend>
    <div class="costs">
      <div v-for="cost of catalogue.costTypes">
        <label>{{ cost.name }}: </label>
        <UtilNumberInput
          v-if="selectedCosts[cost.id]"
          v-model="selectedCosts[cost.id].value"
          class="input"
          @change="changed"
        />
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICost } from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  data() {
    return {
      selectedCosts: {} as Record<string, BSICost>,
    };
  },

  created() {
    this.update();
  },

  props: {
    item: {
      type: Object as PropType<{ costs?: BSICost[] }>,
      required: true,
    },

    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  methods: {
    changed() {
      this.item.costs = Object.values(this.selectedCosts);
      this.$emit("catalogueChanged");
    },

    update() {
      this.selectedCosts = {};
      if (this.catalogue.costIndex) {
        for (let cost of Object.values(this.catalogue.costIndex)) {
          this.selectedCosts[cost.id] = {
            name: cost.name,
            typeId: cost.id,
            value: 0,
          };
        }
      }

      if (this.item.costs) {
        for (let cost of this.item.costs) {
          this.selectedCosts[cost.typeId] = {
            name: cost.name,
            typeId: cost.typeId,
            value: cost.value,
          };
        }
      }
    },
  },

  watch: {
    item() {
      this.update();
    },
  },
};
</script>

<style scoped lang="scss">
.costs {
  display: flex;
  > div {
    margin-right: 10px;
    &:last-child {
      margin-right: 0;
    }
  }
}

.input {
  max-width: 100px;
}
</style>

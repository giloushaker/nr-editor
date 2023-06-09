<template>
  <fieldset>
    <legend>Costs</legend>
    <div class="costs">
      <div v-for="cost of costTypes">
        <label>{{ cost.name }}: </label>
        <UtilNumberInput
          v-if="selectedCosts[cost.id] != null"
          v-model="selectedCosts[cost.id].value"
          class="input"
          @change="changed"
          placeholder="unset"
        />
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICost, BSICostType } from "~/assets/shared/battlescribe/bs_types";

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

  computed: {
    costTypes() {
      let res: BSICostType[] = [];
      for (let elt of this.catalogue.iterateCostTypes()) {
        res.push(elt);
      }
      return res;
    },
  },

  methods: {
    changed() {
      this.item.costs = Object.values(this.selectedCosts).filter((o) => isFinite(o.value));
      this.$emit("catalogueChanged");
    },

    update() {
      this.selectedCosts = {};
      const defaultValue = (this.item as EditorBase).isLink() ? undefined : 0;
      for (let cost of Object.values(this.costTypes)) {
        this.selectedCosts[cost.id] = {
          name: cost.name,
          typeId: cost.id,
          value: defaultValue,
        };
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

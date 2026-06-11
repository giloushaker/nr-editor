<template>
  <fieldset>
    <legend><img src="assets/bsicons/cost.png" /> Costs</legend>
    <div class="costs">
      <div class="costs-cost" v-for="cost of costTypes" :key="cost.id">
        <label :title="cost.name">{{ cost.name }}</label>
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
    },

    update() {
      this.selectedCosts = {};
      const defaultValue = ((this.item as EditorBase).isLink() ? undefined : 0) as number;
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
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px 10px;
  width: 100%;
}
.costs-cost {
  display: flex;
  flex-direction: column;
  min-width: 0;

  label {
    font-size: 0.85em;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}


.input {
  width: 100%;
  box-sizing: border-box;
}
</style>

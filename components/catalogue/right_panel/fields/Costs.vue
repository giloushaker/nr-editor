<template>
  <fieldset>
    <legend><img src="assets/bsicons/cost.png" /> {{ field === "displayCosts" ? "Display costs (cosmetic, shown instead of the costs)" : "Costs" }}</legend>
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
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { BSICost, BSICostType } from "~/assets/shared/battlescribe/bs_types";

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
      type: Object as PropType<{ costs?: BSICost[]; displayCosts?: BSICost[] }>,
      required: true,
    },
    /** Which cost list of the item this block edits: the real `costs`, or the cosmetic `displayCosts`
     *  (shown on the option's line instead of the costs, never summed; modifiers use display::<id>). */
    field: {
      type: String as PropType<"costs" | "displayCosts">,
      default: "costs",
    },

    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  computed: {
    costTypes() {
      const res: BSICostType[] = [];
      for (const elt of this.catalogue.iterateCostTypes()) {
        res.push(elt);
      }
      return res;
    },
  },

  methods: {
    changed() {
      const list = Object.values(this.selectedCosts).filter((o) => isFinite(o.value));
      if (this.field === "displayCosts") {
        if (list.length) this.item.displayCosts = list;
        else delete this.item.displayCosts;
      } else {
        this.item.costs = list;
      }
    },

    update() {
      this.selectedCosts = {};
      const defaultValue = ((this.item as EditorBase).isLink() || this.field === "displayCosts" ? undefined : 0) as number;
      for (const cost of Object.values(this.costTypes)) {
        this.selectedCosts[cost.id] = {
          name: cost.name,
          typeId: cost.id,
          value: defaultValue,
        };
      }

      const current = this.field === "displayCosts" ? this.item.displayCosts : this.item.costs;
      if (current) {
        for (const cost of current) {
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

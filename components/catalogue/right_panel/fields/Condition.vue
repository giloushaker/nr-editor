<template>
  <fieldset>
    <legend>Condition</legend>
    <div class="condition">
      <select v-model="item.type" @change="changed">
        <template v-if="allowNonInstanceOf">
          <option value="lessThan">Less Than</option>
          <option value="greaterThan">Greater Than</option>
          <option value="equalTo">Equal To</option>
          <option value="notEqualTo">Not Equal To</option>
          <option value="atLeast">At Least</option>
          <option value="atMost">At Most</option>
        </template>
        <option value="instanceOf">Instance Of</option>
        <option value="notInstanceOf">Not Instance Of</option>
      </select>
      <UtilNumberInput v-model="item.value" @change="changed" />
      <div>
        <input id="percent" type="checkbox" v-model="item.percentValue" @change="changed" />
        <label for="percent">Percentage?</label>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSICondition } from "~/assets/shared/battlescribe/bs_types";
import NumberInput from "~/components/util/NumberInput.vue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSICondition>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
  computed: {
    allowNonInstanceOf() {
      return ["primary-category", "ancestor"].includes(this.item.scope) == false;
    },
  },
  components: { NumberInput },
  watch: {
    "item.scope"() {
      const allowed = ["instanceOf", "notInstanceOf"];
      if (!this.allowNonInstanceOf && !allowed.includes(this.item.type)) {
        this.item.type = allowed[0] as any;
      }
    },
  },
};
</script>

<style scoped>
.condition {
  display: grid;
  grid-template-columns: 1fr 100px max-content;
  align-items: center;
  grid-gap: 5px;
}
</style>

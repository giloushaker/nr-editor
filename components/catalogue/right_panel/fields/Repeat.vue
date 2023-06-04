<template>
  <fieldset>
    <legend>Repeat</legend>
    <div class="condition">
      <UtilNumberInput v-model="item.repeats" @change="changed" />
      <labeL>times for every </labeL>
      <UtilNumberInput v-model="item.value" @change="changed" />
    </div>
    <div class="bools">
      <div>
        <input id="percent" type="checkbox" v-model="item.percentValue" @change="changed" />
        <label for="percent">Percentage?</label>
      </div>
      <div>
        <input id="percent" type="checkbox" v-model="item.roundUp" @change="changed" />
        <label for="percent">Round up?</label>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIRepeat } from "~/assets/shared/battlescribe/bs_types";
import NumberInput from "~/components/util/NumberInput.vue";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIRepeat>,
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
  components: { NumberInput },
};
</script>

<style scoped lang="scss">
.condition {
  display: grid;
  grid-template-columns: 1fr max-content 1fr max-content;
  align-items: center;
  grid-gap: 5px;
}

.bools {
  display: flex;
  div {
    margin-right: 5px;
  }
}
</style>

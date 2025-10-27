<template>
  <fieldset>
    <legend>Repeat</legend>
    <div class="condition">
      <UtilNumberInput v-model="item.repeats" />
      <label>times for every </label>
      <UtilNumberInput v-model="item.value" />
    </div>
    <div class="bools">
      <div>
        <input id="percent" type="checkbox" v-model="item.percentValue" />
        <label for="percent">Percentage?</label>
      </div>
      <div>
        <input id="percent" type="checkbox" v-model="item.roundUp" />
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

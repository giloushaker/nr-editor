<template>
  <fieldset>
    <legend>Condition</legend>
    <div class="condition">
      <select v-model="item.type">
        <template v-if="allowNonInstanceOf">
          <option value="lessThan">Less Than</option>
          <option value="greaterThan">Greater Than</option>
          <option value="equalTo">Equal To</option>
          <option value="notEqualTo">Not Equal To</option>
          <option value="atLeast">At Least</option>
          <option value="atMost">At Most</option>
          <option value="always">Always</option>
          <option value="never">Never</option>
        </template>
        <template v-if="allowInstanceOf">
          <option value="instanceOf">Instance Of</option>
          <option value="notInstanceOf">Not Instance Of</option>
        </template>
      </select>
      <UtilNumberInput :disabled="instanceOf" v-model="item.value" />
      <div>
        <input :disabled="instanceOf" id="percent" type="checkbox" v-model="item.percentValue" />
        <label :class="{ disabled: instanceOf }" for="percent">Percentage?</label>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { Base, Condition } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import { BSICondition } from "~/assets/shared/battlescribe/bs_types";
import NumberInput from "~/components/util/NumberInput.vue";

export default {
  props: {
    item: {
      type: Object as PropType<EditorBase & BSICondition>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
  computed: {
    allowNonInstanceOf() {
      if (this.parent?.editorTypeName === "costType") return false;
      if (this.item.scope === "ancestor") return false;
      return true;
    },
    allowInstanceOf() {
      if ((this.item as Base as EditorBase).editorTypeName === "localConditionGroup") return false;
      return true;
    },
    instanceOf() {
      return this.item.type?.includes("instance");
    },
    parent() {
      return getModifierOrConditionParent(this.item as Base as EditorBase);
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

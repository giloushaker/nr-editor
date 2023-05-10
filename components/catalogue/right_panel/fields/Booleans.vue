<template>
  <fieldset>
    <legend><slot></slot></legend>
    <div class="booleans">
      <div v-for="field of fields">
        <input
          id="hidden"
          type="checkbox"
          v-model="item[field.field]"
          @change="changed"
          :disabled="!field.enabled"
        />
        <label :class="{ gray: !field.enabled }" for="hidden">{{
          field.name
        }}</label>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { Base } from "~/assets/shared/battlescribe/bs_main";

type PossibleFields = "hidden" | "collective" | "import";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Base>,
      required: true,
    },

    fields: {
      type: Array as PropType<
        { field: PossibleFields; enabled: boolean; name: string }[]
      >,
    },
  },

  methods: {
    changed() {
      this.$emit("catalogueChanged");
    },
  },
};
</script>

<style scoped lang="scss">
.booleans {
  display: flex;
  > div {
    margin-right: 10px;
    &:last-child {
      margin-right: 0;
    }
  }
}
</style>

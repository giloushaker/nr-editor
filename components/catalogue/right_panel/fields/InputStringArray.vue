<template>
  <EditableDiv v-model="_value" @change="$emit('update:modelValue', toValue(_value))" />
</template>
<script lang="ts">
import EditableDiv from "~/components/util/EditableDiv.vue";
export default defineComponent({
  components: { EditableDiv },
  emits: ["update:modelValue"],
  props: {
    modelValue: { type: Array<String> },
  },
  data() {
    return { _value: "" };
  },
  watch: {
    modelValue: {
      immediate: true,
      handler(v) {
        this._value = v ? v.join("\n") : "";
      },
    },
  },
  methods: {
    toValue(valueStr: string) {
      const arr = valueStr.split("\n").filter((o) => o);
      if (!arr.length) return undefined;
      return arr;
    },
  },
});
</script>

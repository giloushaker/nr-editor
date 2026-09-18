<template>
  <input
    class="nrfield"
    :class="[`v-${variant}`, { fit }]"
    :value="modelValue"
    :placeholder="placeholder"
    :style="fit ? { width: `${Math.max(minCh, String(modelValue ?? '').length + 1)}ch` } : undefined"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    @change="$emit('change', ($event.target as HTMLInputElement).value)"
    @keydown.enter.prevent="$emit('enter')"
    @blur="$emit('blur')"
  />
</template>

<script setup lang="ts">
/**
 * One text input, three looks.
 *   box:   a normal field.
 *   ghost: reads as text, shows its border on hover and focus. For values already on the page.
 *   add:   dashed, grey placeholder. For "+ another".
 * `fit` sizes it to its content, for chip-like inline values.
 */
withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    variant?: "box" | "ghost" | "add";
    fit?: boolean;
    minCh?: number;
  }>(),
  { variant: "box", modelValue: "", minCh: 3 },
);
defineEmits<{ "update:modelValue": [value: string]; change: [value: string]; enter: []; blur: [] }>();
</script>

<style lang="scss" scoped>
.nrfield {
  padding: 5px 8px;
  border: 1px solid var(--nr-line);
  border-radius: 4px;
  background: var(--nr-input);
  color: var(--nr-ink);
  min-width: 0;
  &::placeholder {
    color: var(--nr-faint);
  }
  &:focus {
    outline: none;
    border-color: var(--nr-accent);
    box-shadow: 0 0 0 2px var(--nr-accent-soft);
  }
  &.v-ghost {
    border-color: transparent;
    background: transparent;
    padding: 3px 6px;
    &:hover {
      border-color: var(--nr-line);
      background: var(--nr-input);
    }
    &:focus {
      background: var(--nr-input);
    }
  }
  &.v-add {
    border-style: dashed;
    background: transparent;
    color: var(--nr-muted);
    padding: 3px 8px;
    &:focus {
      border-style: solid;
      color: var(--nr-ink);
    }
  }
  &.fit {
    width: auto;
  }
}
</style>

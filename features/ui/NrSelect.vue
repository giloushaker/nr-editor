<template>
  <select class="nrselect" :class="{ ghost }" :value="modelValue" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
    <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
  </select>
</template>

<script setup lang="ts">
defineProps<{ modelValue?: string; options: { value: string; label: string }[]; ghost?: boolean }>();
defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<style lang="scss" scoped>
.nrselect {
  padding: 4px 6px;
  border: 1px solid var(--nr-line);
  border-radius: 4px;
  background: var(--nr-input);
  color: var(--nr-ink);
  font-size: 0.93em;
  &:focus {
    outline: none;
    border-color: var(--nr-accent);
  }
  &.ghost {
    border-color: transparent;
    background: transparent;
    color: var(--nr-muted);
    &:hover {
      border-color: var(--nr-line);
    }
  }
}
</style>

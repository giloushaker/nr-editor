<template>
  <button class="nrmark" type="button" :title="title" @click="$emit('click')"><slot /></button>
</template>

<script setup lang="ts">
/** A tiny monospace badge, like a column's kind. Clickable so it can cycle. */
defineProps<{ title?: string }>();
defineEmits<{ click: [] }>();
</script>

<style lang="scss" scoped>
.nrmark {
  font-family: var(--nr-mono);
  font-size: 0.72em;
  font-weight: 600;
  line-height: 1.5;
  padding: 0 5px;
  border: none;
  border-radius: 3px;
  background: var(--nr-fill);
  color: var(--nr-muted);
  cursor: pointer;
  &:hover {
    color: var(--nr-ink);
  }
}
</style>

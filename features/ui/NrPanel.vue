<template>
  <div class="nrpanel" :class="[tone, { padded }]"><slot /></div>
</template>

<script setup lang="ts">
/** A bordered box. `surface` is a card, `paper` a list container. Children with .nrpanel-row stack with hairlines. */
withDefaults(defineProps<{ tone?: "surface" | "paper" | "info" | "warn"; padded?: boolean }>(), { tone: "surface" });
</script>

<style lang="scss" scoped>
.nrpanel {
  border: 1px solid var(--nr-line);
  border-radius: var(--nr-radius-lg);
  background: var(--nr-surface);
  overflow: hidden;
  &.paper {
    background: var(--nr-paper);
  }
  &.info {
    background: var(--nr-info-soft);
    border-color: transparent;
    color: var(--nr-info);
  }
  &.warn {
    background: var(--nr-warn-soft);
    border-color: transparent;
    color: var(--nr-warn);
  }
  &.padded {
    padding: 12px 14px;
  }
  :deep(.nrpanel-row) {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-top: 1px solid var(--nr-line-soft);
    &:first-child {
      border-top: none;
    }
  }
}
</style>

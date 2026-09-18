<template>
  <span class="nrchip" :class="[tone, { removable }]">
    <slot />
    <button v-if="removable" class="x" type="button" :title="removeTitle" @click.stop="$emit('remove')">✕</button>
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ tone?: "neutral" | "ok" | "new" | "info"; removable?: boolean; removeTitle?: string }>(), {
  tone: "neutral",
  removeTitle: "Remove",
});
defineEmits<{ remove: [] }>();
</script>

<style lang="scss" scoped>
.nrchip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 4px;
  font-size: 0.93em;
  font-weight: 500;
  background: var(--nr-fill);
  color: var(--nr-ink);
  border: 1px solid transparent;
  &.ok {
    background: var(--nr-accent-soft);
    color: var(--nr-accent-ink);
  }
  &.new {
    background: var(--nr-paper);
    color: var(--nr-warn);
    border-color: var(--nr-warn-line);
  }
  &.info {
    background: var(--nr-info-soft);
    color: var(--nr-info);
  }
  &.removable {
    padding-right: 5px;
  }
  .x {
    background: none;
    border: none;
    padding: 0 2px;
    line-height: 1;
    font-size: 0.85em;
    color: var(--nr-faint);
    cursor: pointer;
    &:hover {
      color: var(--nr-danger);
    }
  }
}
</style>

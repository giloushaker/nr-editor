<template>
  <component :is="to ? NuxtLink : 'button'" :to="to" class="nrbtn" :class="[variant, { small }]" :disabled="disabled" :type="to ? undefined : 'button'">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { NuxtLink } from "#components";

withDefaults(defineProps<{ variant?: "default" | "primary" | "ghost"; small?: boolean; disabled?: boolean; to?: string }>(), {
  variant: "default",
});
</script>

<style lang="scss" scoped>
.nrbtn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: var(--nr-radius);
  font-weight: 500;
  border: 1px solid var(--nr-line);
  background: var(--nr-surface);
  color: var(--nr-ink);
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    border-color: var(--nr-faint);
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
  &.primary {
    background: var(--nr-accent);
    border-color: var(--nr-accent);
    color: #fff;
    &:hover {
      background: var(--nr-accent-ink);
      border-color: var(--nr-accent-ink);
    }
  }
  &.ghost {
    background: transparent;
    border-color: transparent;
    color: var(--nr-accent);
    padding-left: 6px;
    padding-right: 6px;
    &:hover {
      border-color: transparent;
      background: var(--nr-accent-soft);
    }
  }
  &.small {
    padding: 4px 9px;
    font-size: 0.93em;
  }
}
</style>

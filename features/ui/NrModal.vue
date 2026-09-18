<template>
  <Teleport to="body">
    <div v-if="open" class="nrmodal-back nr-feature" @mousedown.self="$emit('close')">
      <div class="nrmodal" role="dialog" :aria-label="title" :style="width ? { width: `min(${width}, calc(100vw - 32px))` } : undefined">
        <div class="hd">
          <span class="t">{{ title }}</span>
          <button type="button" class="x" title="Close" @click="$emit('close')">✕</button>
        </div>
        <div class="body"><slot /></div>
        <div v-if="$slots.foot" class="foot"><slot name="foot" /></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/** A small dialog over the page. Click outside or ✕ to close. */
defineProps<{ open: boolean; title: string; width?: string }>();
defineEmits<{ close: [] }>();
</script>

<style lang="scss">
/* Unscoped: it lives under body. */
.nrmodal-back {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 20, 18, 0.35);
}
.nrmodal {
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--nr-line);
  border-radius: var(--nr-radius-lg);
  background: var(--nr-surface);
  box-shadow: var(--nr-shadow);
  .hd {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--nr-line-soft);
    .t {
      font-weight: 600;
      font-size: 1.1em;
    }
    .x {
      margin-left: auto;
      border: none;
      background: none;
      color: var(--nr-faint);
      cursor: pointer;
      &:hover {
        color: var(--nr-ink);
      }
    }
  }
  .body {
    padding: 14px 16px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .foot {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid var(--nr-line-soft);
  }
}
</style>

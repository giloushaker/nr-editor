<template>
  <div class="nrpicker" :class="{ ghost }" ref="root">
    <button ref="btn" type="button" class="cur" :aria-expanded="open" @click="toggle" @keydown.escape="open = false">
      <img v-if="current?.icon" class="oi" :src="current.icon" alt="" />
      <span class="lbl">{{ current?.label ?? placeholder }}</span>
      <span class="caret">▾</span>
    </button>
    <!-- Floated over the page: a panel with overflow hidden would otherwise clip the list. -->
    <Teleport to="body">
      <div v-if="open" class="nrpicker-menu nr-feature" role="listbox" :style="menuStyle" ref="menu">
        <button
          v-for="o in options"
          :key="o.value"
          type="button"
          role="option"
          class="opt"
          :class="{ on: o.value === modelValue }"
          :aria-selected="o.value === modelValue"
          @click="pick(o.value)"
        >
          <span class="oline"><img v-if="o.icon" class="oi" :src="o.icon" alt="" /><span class="ol">{{ o.label }}</span></span>
          <span v-if="o.description" class="od">{{ o.description }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/** A select whose options can explain themselves: label on one line, description under it. */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

export interface PickerOption {
  value: string;
  label: string;
  description?: string;
  /** Image path, relative, "assets/bsicons/constraint.png". */
  icon?: string;
}
const props = withDefaults(defineProps<{ modelValue?: string; options: PickerOption[]; ghost?: boolean; placeholder?: string }>(), {
  placeholder: "Choose",
});
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const btn = ref<HTMLElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});
const current = computed(() => props.options.find((o) => o.value === props.modelValue));

const GAP = 4; // between button and menu
const EDGE = 12; // kept clear of the viewport edges
function place() {
  const r = btn.value?.getBoundingClientRect();
  if (!r) return;
  const below = window.innerHeight - r.bottom - GAP - EDGE;
  const above = r.top - GAP - EDGE;
  // Open downward unless there is clearly more room above; either way cap the height so the
  // list never touches the viewport edge.
  const down = below >= 200 || below >= above;
  menuStyle.value = {
    left: `${Math.max(EDGE, Math.min(r.left, window.innerWidth - EDGE - r.width))}px`,
    minWidth: `${r.width}px`,
    maxHeight: `${Math.max(120, down ? below : above)}px`,
    ...(down ? { top: `${r.bottom + GAP}px` } : { bottom: `${window.innerHeight - r.top + GAP}px` }),
  };
}
function toggle() {
  open.value = !open.value;
  if (open.value) place();
}
function pick(v: string) {
  open.value = false;
  if (v !== props.modelValue) emit("update:modelValue", v);
}
function onDocDown(e: MouseEvent) {
  if (!open.value) return;
  const t = e.target as Node;
  if (root.value?.contains(t) || menu.value?.contains(t)) return;
  open.value = false;
}
function onMove() {
  if (open.value) place();
}
onMounted(() => {
  document.addEventListener("mousedown", onDocDown);
  window.addEventListener("resize", onMove);
  document.addEventListener("scroll", onMove, true);
});
onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocDown);
  window.removeEventListener("resize", onMove);
  document.removeEventListener("scroll", onMove, true);
});
</script>

<style lang="scss" scoped>
.nrpicker {
  position: relative;
  display: inline-block;
  min-width: 0;
}
.cur {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--nr-line);
  border-radius: 4px;
  background: var(--nr-input);
  color: var(--nr-ink);
  cursor: pointer;
  text-align: left;
  .lbl {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .caret {
    color: var(--nr-faint);
    font-size: 0.85em;
  }
  &:hover {
    border-color: var(--nr-faint);
  }
  &:focus-visible {
    outline: none;
    border-color: var(--nr-accent);
    box-shadow: 0 0 0 2px var(--nr-accent-soft);
  }
}
.ghost .cur {
  border-color: transparent;
  background: transparent;
  color: var(--nr-muted);
  padding: 3px 4px;
  &:hover {
    border-color: var(--nr-line);
  }
}
</style>

<style lang="scss">
/* Unscoped: the menu lives under body, and the icon sits in both the button and the rows. */
.nrpicker .oi,
.nrpicker-menu .oi {
  width: 14px;
  height: 14px;
  vertical-align: -2px;
  margin-right: 5px;
  flex-shrink: 0;
}
.nrpicker-menu {
  max-height: min(60vh, 360px);
  overflow: auto;
}
</style>

<style lang="scss">
/* Unscoped: the menu lives under body. Namespaced by class instead. */
.nrpicker-menu {
  position: fixed;
  z-index: 1200;
  /* Wide enough that a description stays on one line; the viewport is the only cap. */
  width: max-content;
  max-width: calc(100vw - 24px);
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--nr-line);
  border-radius: var(--nr-radius-lg);
  background: var(--nr-input);
  box-shadow: var(--nr-shadow);
  .opt {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--nr-ink);
    cursor: pointer;
    text-align: left;
    font: inherit;
    &:hover,
    &:focus-visible {
      background: var(--nr-paper);
      outline: none;
    }
    &.on {
      background: var(--nr-accent-soft);
      .ol {
        color: var(--nr-accent-ink);
      }
    }
    .oline {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
    }
    .od {
      font-size: 0.86em;
      color: var(--nr-muted);
      white-space: nowrap;
    }
  }
}
</style>

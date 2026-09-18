<template>
  <div class="nrsuggest" ref="root">
    <input
      ref="input"
      class="nrfield add"
      :value="query"
      :placeholder="placeholder"
      @input="onInput(($event.target as HTMLInputElement).value)"
      @paste="onPaste"
      @focus="onFocus"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="pick()"
      @keydown.escape="open = false"
      @blur="onBlur"
    />
    <Teleport to="body">
      <div v-if="open && rows.length" class="nrsuggest-menu nr-feature" :style="menuStyle" ref="menu">
        <button
          v-for="(r, i) in rows"
          :key="r.key"
          type="button"
          class="opt"
          :class="{ on: i === cursor, create: r.create }"
          @mousedown.prevent
          @click="pick(i)"
        >
          <span class="ol">{{ r.label }}</span>
          <span v-if="r.note" class="od">{{ r.note }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * A name field over a list of known names. Typing shows the nearest existing names first and
 * "create as a new name" last, so a near duplicate is seen before it is made. Enter takes the
 * highlighted row. Board 2b's wargear field.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

export interface Suggestion {
  name: string;
  /** Where it comes from, "shared", "Space Marines". */
  note?: string;
}
const props = withDefaults(defineProps<{ options: Suggestion[]; placeholder?: string; createLabel?: string }>(), {
  placeholder: "",
  createLabel: "Create as a new name",
});
const emit = defineEmits<{ pick: [name: string, isNew: boolean] }>();

const query = ref("");
const open = ref(false);
const cursor = ref(0);
const root = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});

function fold(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
interface Row {
  key: string;
  label: string;
  note?: string;
  name: string;
  create?: boolean;
}
const rows = computed<Row[]>(() => {
  const q = fold(query.value);
  if (!q) return [];
  const exact: Suggestion[] = [];
  const starts: Suggestion[] = [];
  const within: Suggestion[] = [];
  for (const o of props.options) {
    const f = fold(o.name);
    if (f === q) exact.push(o);
    else if (f.startsWith(q)) starts.push(o);
    else if (f.includes(q)) within.push(o);
  }
  const found: Row[] = [...exact, ...starts, ...within].slice(0, 8).map((o) => ({ key: o.name + (o.note ?? ""), label: o.name, note: o.note, name: o.name }));
  // An exact match (case aside) is the same name: no "create" row for it.
  if (!exact.length) found.push({ key: "__new", label: `${props.createLabel}: “${query.value.trim()}”`, name: query.value.trim(), create: true });
  return found;
});

function onFocus() {
  open.value = true;
  place();
}
function onInput(v: string) {
  query.value = v;
  open.value = true;
  cursor.value = 0;
  place();
}
function move(d: number) {
  if (!rows.value.length) return;
  cursor.value = (cursor.value + d + rows.value.length) % rows.value.length;
}
function pick(i = cursor.value) {
  const r = rows.value[i];
  if (!r) return;
  emit("pick", r.name, !!r.create);
  query.value = "";
  open.value = false;
}
/** Several lines pasted at once, as copied from a book's option list: one pick per line, bullets dropped. */
function onPaste(e: ClipboardEvent) {
  const lines = (e.clipboardData?.getData("text") ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-–—•*]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length < 2) return;
  e.preventDefault();
  for (const name of lines) {
    const known = props.options.find((o) => fold(o.name) === fold(name));
    emit("pick", known?.name ?? name, !known);
  }
  query.value = "";
  open.value = false;
}
function onBlur() {
  // Let a click on the menu land first.
  setTimeout(() => (open.value = false), 120);
}

const GAP = 4;
const EDGE = 12;
function place() {
  const r = input.value?.getBoundingClientRect();
  if (!r) return;
  const below = window.innerHeight - r.bottom - GAP - EDGE;
  const above = r.top - GAP - EDGE;
  const down = below >= 200 || below >= above;
  menuStyle.value = {
    left: `${Math.max(EDGE, Math.min(r.left, window.innerWidth - EDGE - 320))}px`,
    minWidth: `${Math.max(r.width, 240)}px`,
    maxHeight: `${Math.max(120, down ? below : above)}px`,
    ...(down ? { top: `${r.bottom + GAP}px` } : { bottom: `${window.innerHeight - r.top + GAP}px` }),
  };
}
function onMove() {
  if (open.value) place();
}
onMounted(() => {
  window.addEventListener("resize", onMove);
  document.addEventListener("scroll", onMove, true);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", onMove);
  document.removeEventListener("scroll", onMove, true);
});
</script>

<style lang="scss" scoped>
.nrsuggest {
  display: inline-block;
  min-width: 0;
}
.nrfield {
  width: 100%;
  box-sizing: border-box;
  padding: 3px 8px;
  border: 1px dashed var(--nr-line);
  border-radius: 4px;
  background: transparent;
  color: var(--nr-ink);
  &::placeholder {
    color: var(--nr-faint);
  }
  &:focus {
    outline: none;
    border-style: solid;
    border-color: var(--nr-accent);
    box-shadow: 0 0 0 2px var(--nr-accent-soft);
  }
}
</style>

<style lang="scss">
/* Unscoped: the menu lives under body. */
.nrsuggest-menu {
  position: fixed;
  z-index: 1200;
  width: max-content;
  max-width: calc(100vw - 24px);
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--nr-line);
  border-radius: var(--nr-radius-lg);
  background: var(--nr-surface);
  box-shadow: var(--nr-shadow);
  .opt {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--nr-ink);
    cursor: pointer;
    text-align: left;
    font: inherit;
    &.on,
    &:hover {
      background: var(--nr-accent-soft);
    }
    &.create {
      color: var(--nr-warn);
      border-top: 1px solid var(--nr-line-soft);
      border-radius: 0;
      margin-top: 2px;
    }
    .od {
      margin-left: auto;
      font-size: 0.86em;
      color: var(--nr-muted);
      white-space: nowrap;
    }
  }
}
</style>

<template>
  <span class="nrexpr" :class="{ bad: problem }" ref="root">
    <input
      ref="input"
      class="field"
      :class="{ mono: !text || text.includes('$') }"
      :value="text"
      :placeholder="placeholder"
      :title="problem ?? ''"
      spellcheck="false"
      autocomplete="off"
      @input="onInput"
      @keydown="onKey"
      @focus="onFocus"
      @blur="onBlur"
      @click="refresh"
    />
    <button type="button" class="all" title="What can go here" tabindex="-1" @mousedown.prevent @click="toggleAll">$</button>
    <Teleport to="body">
      <div v-if="open && rows.length" class="nrsuggest-menu nr-feature" :style="menuStyle" ref="menu">
        <div v-if="heading" class="head">{{ heading }}</div>
        <button v-for="(r, i) in rows" :key="r.insert + i" type="button" class="opt" :class="{ on: i === cursor }" @mousedown.prevent @click="take(i)">
          <span class="ol mono">{{ r.label }}</span>
          <span v-if="r.note" class="od">{{ r.note }}</span>
        </button>
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
/**
 * A field for a small expression language: `$name` references, `.prop` after one, numbers,
 * words and + - * / ( ) ??. Typing `$` lists what can go here; `.` after a reference lists its
 * properties; the `$` button lists everything. Who provides the names is the caller's business,
 * so the same field serves recipes, queries and anything else that names things with `$`.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface ExprItem {
  /** What gets inserted: "$model", "min". */
  name: string;
  /** What it is, shown on the right. */
  note?: string;
}
const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    /** Everything that may follow a `$`. */
    refs: ExprItem[];
    /** What may follow "$ref.": its properties. Nothing means the reference has none. */
    propsOf?: (ref: string) => ExprItem[];
    /** A reason the current text is wrong, shown as a red field with the reason as its title. */
    problem?: string;
  }>(),
  { placeholder: "", propsOf: undefined, problem: undefined },
);
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const text = ref(props.modelValue);
watch(
  () => props.modelValue,
  (v) => {
    if (v !== text.value) text.value = v;
  },
);
const input = ref<HTMLInputElement | null>(null);
const root = ref<HTMLElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const open = ref(false);
const cursor = ref(0);
const showAll = ref(false);
const menuStyle = ref<Record<string, string>>({});

/** The `$…` token the caret is in, with where it starts: "$row1.i" -> { ref: "row1", prop: "i" }. */
const token = computed(() => {
  const at = input.value?.selectionStart ?? text.value.length;
  const before = text.value.slice(0, at);
  const m = /\$([A-Za-z_][\w:]*)?(?:\.([\w$]*))?$/.exec(before);
  if (!m) return null;
  return { start: at - m[0].length, ref: m[1] ?? "", prop: m[2], hasDot: m[0].includes(".") };
});
const fold = (s: string) => s.toLowerCase();
interface Row {
  label: string;
  note?: string;
  insert: string;
  /** Replace from here to the caret. */
  from: number;
}
const rows = computed<Row[]>(() => {
  const at = input.value?.selectionStart ?? text.value.length;
  if (showAll.value) return props.refs.map((r) => ({ label: r.name, note: r.note, insert: r.name, from: at }));
  const t = token.value;
  if (!t) return [];
  if (t.hasDot) {
    const list = props.propsOf?.(t.ref) ?? [];
    const q = fold(t.prop ?? "");
    return list.filter((p) => fold(p.name).startsWith(q)).map((p) => ({ label: `.${p.name}`, note: p.note, insert: `$${t.ref}.${p.name}`, from: t.start }));
  }
  const q = fold(t.ref);
  return props.refs.filter((r) => fold(r.name.slice(1)).startsWith(q) || fold(r.name.slice(1)).includes(q)).map((r) => ({ label: r.name, note: r.note, insert: r.name, from: t.start }));
});
const heading = computed(() => (showAll.value ? "What can go here" : token.value?.hasDot ? `properties of $${token.value.ref}` : ""));

function onInput(e: Event) {
  text.value = (e.target as HTMLInputElement).value;
  showAll.value = false;
  cursor.value = 0;
  refresh();
}
function refresh() {
  nextTick(() => {
    open.value = !!token.value || showAll.value;
    place();
  });
}
function onFocus() {
  refresh();
}
function onBlur() {
  setTimeout(() => {
    open.value = false;
    showAll.value = false;
  }, 120);
  commit();
}
function commit() {
  if (text.value !== props.modelValue) emit("update:modelValue", text.value);
}
function toggleAll() {
  showAll.value = !showAll.value;
  open.value = showAll.value;
  cursor.value = 0;
  input.value?.focus();
  place();
}
function onKey(e: KeyboardEvent) {
  if (open.value && rows.value.length) {
    if (e.key === "ArrowDown") {
      cursor.value = (cursor.value + 1) % rows.value.length;
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      cursor.value = (cursor.value - 1 + rows.value.length) % rows.value.length;
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      take(cursor.value);
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      open.value = false;
      showAll.value = false;
      e.preventDefault();
      return;
    }
  }
  if (e.key === "Enter") {
    commit();
    input.value?.blur();
  }
}
function take(i: number) {
  const r = rows.value[i];
  const el = input.value;
  if (!r || !el) return;
  const at = el.selectionStart ?? text.value.length;
  text.value = text.value.slice(0, r.from) + r.insert + text.value.slice(at);
  const caret = r.from + r.insert.length;
  showAll.value = false;
  nextTick(() => {
    el.setSelectionRange(caret, caret);
    // A reference with properties keeps the list open for the dot.
    open.value = false;
  });
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
    left: `${Math.max(EDGE, Math.min(r.left, window.innerWidth - EDGE - 360))}px`,
    minWidth: `${Math.max(r.width, 280)}px`,
    maxHeight: `${Math.min(360, Math.max(120, down ? below : above))}px`,
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
.nrexpr {
  display: inline-flex;
  align-items: stretch;
  min-width: 0;
  border: 1px solid var(--nr-line);
  border-radius: 4px;
  background: var(--nr-surface);
  &:focus-within {
    border-color: var(--nr-accent);
    box-shadow: 0 0 0 2px var(--nr-accent-soft);
  }
  &.bad {
    border-color: var(--nr-danger);
  }
}
.field {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--nr-ink);
  padding: 3px 6px;
  font: inherit;
  &.mono {
    font-family: var(--nr-mono);
    font-size: 0.92em;
  }
  &::placeholder {
    color: var(--nr-faint);
    font-family: var(--nr-font);
  }
  &:focus {
    outline: none;
  }
}
.all {
  border: none;
  border-left: 1px solid var(--nr-line-soft);
  background: transparent;
  color: var(--nr-faint);
  font-family: var(--nr-mono);
  padding: 0 6px;
  cursor: pointer;
  &:hover {
    color: var(--nr-accent-ink);
    background: var(--nr-fill);
  }
}
.mono {
  font-family: var(--nr-mono);
}
</style>

<style lang="scss">
.nrsuggest-menu .head {
  padding: 4px 10px 2px;
  font-size: 0.8em;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--nr-muted);
}
</style>

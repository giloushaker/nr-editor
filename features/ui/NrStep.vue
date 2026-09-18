<template>
  <section class="nrstep" :class="[state, { sub, open }]">
    <button type="button" class="hd" :aria-expanded="open" @click="open = !open">
      <span class="n">{{ state === "done" ? "✓" : n }}</span>
      <span class="t">{{ title }}</span>
      <span v-if="!open && summary?.length" class="sum">
        <NrChip v-for="s in shown" :key="s" tone="ok">{{ s }}</NrChip>
        <span v-if="shown.length < summary.length" class="more">+{{ summary.length - shown.length }} more</span>
      </span>
      <span v-else-if="open && hint" class="hint">{{ hint }}</span>
      <span class="chev">{{ open ? "▾" : "▸" }}</span>
    </button>
    <div v-if="open" class="body"><slot /></div>
  </section>
</template>

<script setup lang="ts">
/**
 * One row of a checklist. Put several in an NrPanel tone="paper". A done step starts collapsed
 * with its summary on the header line; any step can be opened or closed by clicking the header.
 */
import { computed, ref, watch } from "vue";
import NrChip from "./NrChip.vue";

const props = defineProps<{
  n: number | string;
  state: "done" | "live" | "later";
  title: string;
  /** Shown as pills on the header while collapsed, e.g. ["Model", "Weapon"]. */
  summary?: string[];
  /** Shown on the header while open, the one-line explanation of the step. */
  hint?: string;
  sub?: boolean;
}>();

const open = ref(props.state !== "done");
// ponytail: character budget instead of measuring; the row is overflow hidden if a name is huge.
const shown = computed(() => {
  const out: string[] = [];
  let len = 0;
  for (const s of props.summary || []) {
    len += s.length + 3;
    if (len > 60 && out.length) break;
    out.push(s);
  }
  return out;
});
// A step that just got done folds up; one that stops being done (its last item removed) unfolds.
watch(
  () => props.state,
  (s, was) => {
    if (s === "done" && was !== "done") open.value = false;
    if (s !== "done" && was === "done") open.value = true;
  },
);
</script>

<style lang="scss" scoped>
.nrstep {
  border-top: 1px solid var(--nr-line-soft);
  &:first-child {
    border-top: none;
  }
  &.live {
    background: var(--nr-surface);
  }
  &.later {
    color: var(--nr-muted);
    .n {
      color: var(--nr-faint);
    }
  }
  &.sub .hd {
    padding-left: 54px;
    .n {
      width: 20px;
      height: 20px;
    }
  }
}
.hd {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  &:hover .chev {
    color: var(--nr-ink);
  }
}
.n {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--nr-line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--nr-mono);
  font-size: 0.8em;
  color: var(--nr-muted);
  flex-shrink: 0;
  .live > .hd > & {
    background: var(--nr-accent);
    border-color: var(--nr-accent);
    color: #fff;
  }
  .done > .hd > & {
    background: var(--nr-accent-soft);
    border-color: var(--nr-accent);
    color: var(--nr-accent-ink);
  }
}
.t {
  font-weight: 600;
  font-size: 1.1em;
}
.sum {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  .more {
    color: var(--nr-muted);
    font-size: 0.93em;
  }
}
.hint {
  color: var(--nr-muted);
  font-size: 0.93em;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chev {
  margin-left: auto;
  color: var(--nr-faint);
  font-size: 0.9em;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 16px 14px 54px;
  .sub > & {
    padding-left: 88px;
  }
}
</style>

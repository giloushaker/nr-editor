<template>
  <div class="pastebox">
    <!-- Stays visible: editing the text re-reads it, so a line can be split or fixed in place. -->
    <textarea class="text" rows="3" v-model="text" spellcheck="false" :placeholder="`Paste the ${typeName.toLowerCase()} table here`" @paste="onPaste" @input="result && readText()" />
    <div v-if="!result" class="row">
      <NrButton small variant="primary" :disabled="!text.trim()" @click="readText">Read it</NrButton>
    </div>

    <template v-else>
      <!-- What the text is: the reader's guess is selected, the others are one click away. -->
      <div class="modes" role="tablist">
        <button type="button" role="tab" :class="{ on: mode === 'table' }" @click="pick('table')">
          Stat lines <span v-if="result.ok" class="n">{{ result.rows.length }}</span>
        </button>
        <button v-if="allowEntries" type="button" role="tab" :class="{ on: mode === 'entries' }" @click="pick('entries')">
          Entries <span class="n">{{ plainLines.length }}</span>
        </button>
        <button v-if="allowRule" type="button" role="tab" :class="{ on: mode === 'rule' }" @click="pick('rule')">Rule</button>
      </div>

      <NrPanel tone="paper" class="box preview">
        <!-- stat lines -->
        <template v-if="mode === 'table'">
          <div class="row head">
            <span class="lbl">Stat line of</span>
            <NrPicker :model-value="result.ok ? detected.id : ''" :options="typeOptions" placeholder="pick a type…" @update:model-value="force" />
            <span v-if="result.ok && result.unread.length" class="hint warn">{{ result.unread.length }} not placed</span>
          </div>
          <table v-if="result.ok" class="tbl">
            <thead>
              <tr>
                <th class="n">Name</th>
                <th v-for="c in cols" :key="c.id" :class="{ wide: c.format.preset === 'text' || c.format.preset === 'long' }">{{ c.name }}</th>
                <th class="tools"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in result.rows" :key="i" :class="{ sub: r.sub, dup: existing.has(fold(r.name)), group: !Object.keys(r.values).length }">
                <td class="n">
                  <span v-if="r.sub" class="hint">↳ </span>
                  <input class="cell name" v-model="r.name" />
                  <span v-if="!r.sub && existing.has(fold(r.name))" class="hint"> exists</span>
                </td>
                <template v-if="Object.keys(r.values).length">
                  <td v-for="c in cols" :key="c.id" :class="flagClass(r, c.id)" :title="flagTitle(r, c.id)">
                    <textarea v-if="c.format.preset === 'long'" v-grow v-unwrap-paste class="cell long" rows="1" :value="r.values[c.id] ?? ''" @input="edit(r, c.id, ($event.target as HTMLTextAreaElement).value)" />
                    <input v-else class="cell" :value="r.values[c.id] ?? ''" @input="edit(r, c.id, ($event.target as HTMLInputElement).value)" />
                  </td>
                </template>
                <td v-else :colspan="cols.length" class="hint grp">group</td>
                <td class="tools"><button type="button" class="x" title="Leave this one out" @click="result.rows.splice(i, 1)">✕</button></td>
              </tr>
            </tbody>
          </table>
          <div v-if="result.ok && result.unread.length" class="unread">
            <code v-for="(u, i) in result.unread" :key="i">{{ u }}</code>
          </div>
          <p v-if="!result.ok" class="miss">
            This does not read as a stat line of any type. Pick a type above to read it as that anyway, or paste the table with its header row so the column names are in the text.
          </p>
        </template>

        <!-- entries: one per line, a link where the name is already shared -->
        <ul v-else-if="mode === 'entries'" class="lines">
          <li v-for="(l, i) in plainLines" :key="i">
            <span class="cnt">{{ l.count ? `${l.count}×` : "" }}</span>
            <span class="nm">{{ l.name }}</span>
            <NrChip :tone="existing.has(fold(l.name)) ? 'ok' : 'new'">{{ existing.has(fold(l.name)) ? "links to shared" : "new entry" }}</NrChip>
          </li>
        </ul>

        <!-- rule: the first line names it -->
        <div v-else class="rule">
          <b>{{ ruleName || "Untitled rule" }}</b>
          <pre class="ruletext">{{ ruleText || "(no text: the first line is the name, the rest is the rule)" }}</pre>
        </div>
      </NrPanel>

      <div class="row actions">
        <NrButton variant="primary" :disabled="!canAdd" @click="accept">{{ actionLabel }}</NrButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/** The paste box on a type's section: text in, a preview of what it reads as, one button to create it. */
import { computed, onMounted, ref } from "vue";
import { matchesFormat } from "~/features/setup/formats";
import type { SetupProfileType } from "~/features/setup/model";
import { NrButton, NrChip, NrPanel, NrPicker, vGrow } from "~/features/ui";
import type { PasteResult, PasteSuccess, PastedRow } from "./model";
import { parsePaste } from "./parse";
import { readLines, unwrap, vUnwrapPaste, type PastedLine } from "./text";

type Mode = "table" | "entries" | "rule";

const props = defineProps<{
  /** The type this section shows; the reader still tries every type and says which one fit. */
  type: SetupProfileType;
  types: SetupProfileType[];
  /** Names already shared, so the preview marks what will be filled rather than created. */
  existingNames: string[];
  /** Text pasted elsewhere on the page and handed here: read it at once. */
  initial?: string;
  /** Offer "it is a rule" when nothing fits: the owner knows where a rule goes. */
  allowRule?: boolean;
  /** Offer "these are entries", one per line, a link where the name is in existingNames. */
  allowEntries?: boolean;
}>();
const emit = defineEmits<{ accept: [result: PasteSuccess]; rule: [name: string, text: string]; lines: [lines: PastedLine[]] }>();

const text = ref("");
const result = ref<PasteResult | null>(null);
/** A tab the author clicked; until then the reader's guess is shown. */
const chosen = ref<Mode | undefined>();
const typeName = computed(() => props.type.name);
/** The type the reader settled on; the section's own type until something is read. */
const detected = computed(() => {
  const r = result.value;
  return (r?.ok && props.types.find((x) => x.id === r.typeId)) || props.type;
});
const cols = computed(() => detected.value.columns);
/** Every type the text also reads as, well enough to offer. Re-read per type only while a preview is open. */
const fitting = computed(() => {
  if (!result.value?.ok) return [];
  return props.types
    .filter((t) => {
      const r = parsePaste(text.value, props.types, t.id, t.id);
      return r.ok && r.confidence >= 0.45;
    })
    .map((t) => ({ value: t.id, label: t.name }));
});
const typeOptions = computed(() => {
  const fit = new Set(fitting.value.map((f) => f.value));
  return [...fitting.value, ...props.types.filter((t) => !fit.has(t.id)).map((t) => ({ value: t.id, label: t.name }))];
});
const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const existing = computed(() => new Set(props.existingNames.map(fold)));

const plainLines = computed(() => readLines(text.value));
const ruleLines = computed(() => text.value.trim().split(/\r?\n/));
const ruleName = computed(() => ruleLines.value[0]?.trim() ?? "");
const ruleText = computed(() => unwrap(ruleLines.value.slice(1).join("\n")));

/**
 * The reader's guess. A confident table wins; a short list of things, counted or not, is
 * entries; several lines of prose is a rule; else the table, with its miss explained.
 */
const guess = computed<Mode>(() => {
  const r = result.value;
  if (r?.ok && r.confidence >= 0.6) return "table";
  const lines = plainLines.value;
  const listy = lines.length > 0 && lines.every((l) => l.count || l.name.split(/\s+/).length <= 5);
  if (props.allowEntries && listy) return "entries";
  if (r?.ok) return "table";
  if (props.allowRule && ruleLines.value.length > 1) return "rule";
  return props.allowEntries ? "entries" : props.allowRule ? "rule" : "table";
});
const mode = computed<Mode>(() => chosen.value ?? guess.value);
function pick(m: Mode) {
  chosen.value = m;
}

const canAdd = computed(() => {
  if (mode.value === "table") return !!result.value?.ok && result.value.rows.length > 0;
  if (mode.value === "entries") return plainLines.value.length > 0;
  return ruleName.value.length > 0;
});
const actionLabel = computed(() => {
  const r = result.value;
  if (mode.value === "table") {
    const n = r?.ok ? r.rows.length : 0;
    return n ? `Add ${n} stat line${n === 1 ? "" : "s"}` : "Nothing to add";
  }
  if (mode.value === "entries") {
    const n = plainLines.value.length;
    return `Add ${n} ${n === 1 ? "entry" : "entries"}`;
  }
  return "Add rule";
});
function accept() {
  const r = result.value;
  if (mode.value === "table" && r?.ok) emit("accept", r);
  else if (mode.value === "entries") emit("lines", plainLines.value);
  else emit("rule", ruleName.value, ruleText.value);
  reset();
}

onMounted(() => {
  if (props.initial?.trim()) {
    text.value = props.initial;
    readText();
  }
});
/** A type the author picked by hand; kept so editing the text re-reads as that type. */
const forced = ref<string | undefined>();
function readText() {
  result.value = parsePaste(text.value, props.types, forced.value ?? props.type.id, forced.value);
}
/** The author says which type it is: read it as that, however badly it fits. */
function force(typeId: string) {
  if (!typeId) return;
  forced.value = typeId;
  chosen.value = "table";
  readText();
}
/** Pasting into the empty box reads at once; the author sees rows, not text. */
function onPaste(e: ClipboardEvent) {
  const pasted = e.clipboardData?.getData("text") ?? "";
  if (!text.value.trim() && pasted.trim()) {
    e.preventDefault();
    text.value = pasted;
    readText();
  }
}
/** A corrected cell drops its flag when it fits now; a wrong correction gets one. */
function edit(r: PastedRow, columnId: string, value: string) {
  r.values[columnId] = value;
  r.flags = r.flags.filter((f) => f.columnId !== columnId);
  const col = cols.value.find((c) => c.id === columnId);
  if (col && value && !matchesFormat(col.format, value)) r.flags.push({ columnId, reason: "format" });
}
function flagOf(r: PastedRow, columnId: string) {
  return r.flags.find((f) => f.columnId === columnId);
}
function flagClass(r: PastedRow, columnId: string) {
  const f = flagOf(r, columnId);
  return f ? (f.reason === "guessed" ? "guess" : "bad") : "";
}
function flagTitle(r: PastedRow, columnId: string) {
  const f = flagOf(r, columnId);
  return f?.reason === "missing" ? "Nothing read for this cell" : f?.reason === "format" ? "Does not look like this column's values" : f?.reason === "guessed" ? "OCR glyph fixed" : "";
}
function reset() {
  text.value = "";
  result.value = null;
  chosen.value = undefined;
  forced.value = undefined;
}
defineExpose({ reset });
</script>

<style lang="scss" scoped>
.pastebox {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.box {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.text {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-family: var(--nr-mono);
  font-size: 0.9em;
  line-height: 1.5;
  padding: 8px 10px;
  border: 1px solid var(--nr-line);
  border-radius: var(--nr-radius);
  background: var(--nr-input);
  color: var(--nr-ink);
  resize: vertical;
  &::placeholder {
    color: var(--nr-faint);
  }
  &:focus {
    outline: none;
    border-color: var(--nr-accent);
    box-shadow: 0 0 0 2px var(--nr-accent-soft);
  }
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.actions {
  justify-content: flex-end;
}
.hint {
  color: var(--nr-muted);
  font-size: 0.93em;
  &.warn {
    color: var(--nr-warn);
  }
}
.lbl {
  color: var(--nr-muted);
}
.miss {
  margin: 0;
  color: var(--nr-muted);
  max-width: 64ch;
}
.modes {
  display: flex;
  gap: 2px;
  padding: 2px;
  width: fit-content;
  border: 1px solid var(--nr-line);
  border-radius: var(--nr-radius);
  background: var(--nr-paper);
  button {
    border: none;
    background: transparent;
    color: var(--nr-muted);
    font: inherit;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    &:hover {
      color: var(--nr-ink);
    }
    &.on {
      background: var(--nr-surface);
      color: var(--nr-ink);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    }
    .n {
      margin-left: 4px;
      font-family: var(--nr-mono);
      font-size: 0.85em;
      color: var(--nr-faint);
    }
    &.on .n {
      color: var(--nr-accent);
    }
  }
}
.tbl {
  border-collapse: collapse;
  th,
  td {
    padding: 3px 8px;
    text-align: center;
    border-bottom: 1px solid var(--nr-line-soft);
    border-left: 1px solid var(--nr-line-soft);
    font-family: var(--nr-mono);
    font-size: 0.9em;
    &:first-child {
      border-left: none;
    }
  }
  th {
    font-family: var(--nr-font);
    font-weight: 600;
    font-size: 0.85em;
    letter-spacing: 0.02em;
    color: var(--nr-muted);
    border-bottom-color: var(--nr-line);
  }
  .n {
    text-align: left;
    font-family: var(--nr-font);
    white-space: nowrap;
  }
  .wide {
    min-width: 18ch;
  }
  .tools {
    width: 20px;
    border-left: none;
  }
  .grp {
    text-align: left;
    font-family: var(--nr-font);
    font-style: italic;
  }
  .cell {
    width: 100%;
    min-width: 4ch;
    box-sizing: border-box;
    padding: 2px 4px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    font: inherit;
    color: inherit;
    text-align: inherit;
    &:hover,
    &:focus {
      border-color: var(--nr-line);
      background: var(--nr-input);
      outline: none;
    }
  }
  .name {
    width: 22ch;
    text-align: left;
  }
  .long {
    display: block;
    min-width: 40ch;
    text-align: left;
    resize: none;
    overflow: hidden;
    line-height: 1.35;
  }
  .x {
    border: none;
    background: none;
    color: var(--nr-faint);
    cursor: pointer;
    &:hover {
      color: var(--nr-danger);
    }
  }
  .sub .n {
    padding-left: 20px;
  }
  .dup .n {
    color: var(--nr-muted);
  }
  td.bad {
    background: var(--nr-warn-soft);
    color: var(--nr-warn);
  }
  td.guess {
    background: var(--nr-info-soft);
  }
}
.lines {
  list-style: none;
  margin: 0;
  padding: 0;
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 0;
    border-top: 1px solid var(--nr-line-soft);
    &:first-child {
      border-top: none;
      padding-top: 0;
    }
  }
  .cnt {
    width: 3ch;
    text-align: right;
    font-family: var(--nr-mono);
    color: var(--nr-muted);
  }
  .nm {
    flex: 1;
  }
}
.rule {
  display: flex;
  flex-direction: column;
  gap: 6px;
  .ruletext {
    margin: 0;
    font: inherit;
    white-space: pre-wrap;
    color: var(--nr-muted);
  }
}
.unread {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  code {
    font-family: var(--nr-mono);
    font-size: 0.85em;
    padding: 1px 6px;
    background: var(--nr-fill);
    border-radius: 3px;
  }
}
</style>

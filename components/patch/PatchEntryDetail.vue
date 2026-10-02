<template>
  <div class="detail">
    <div class="head">
      <span class="status" :class="row.status">{{ STATUS_LABELS[row.status] }}</span>
      <span v-if="decision" class="decision" :class="decision.status">{{ decision.status }}</span>
      <span v-else-if="changedSinceDecision" class="decision changed" title="The entry changed since it was decided">changed since decision</span>
      <code class="key">{{ row.info.key }}</code>
      <span v-for="op in row.info.ops" :key="op" class="op">{{ op }}</span>
      <span class="muted files">{{ row.info.files.join(", ") }}</span>
    </div>

    <p v-if="row.info.note" class="note">
      <template v-for="(part, i) in noteParts(row.info.note)" :key="i">
        <a v-if="part.href" :href="part.href" target="_blank">{{ part.text }}</a>
        <template v-else>{{ part.text }}</template>
      </template>
    </p>
    <p v-else class="note muted">No $note on this entry.</p>

    <div v-if="!row.targets.length" class="issue">
      Nothing in the loaded data has {{ row.info.field }} = "{{ row.info.value }}". The entry is dead: the object was removed or
      re-identified upstream, or it belongs to another system.
    </div>

    <section v-for="({ target, summaries: items, json }, i) in views" :key="i" class="target">
      <div class="where">
        <img class="typeIcon" src="assets/bsicons/catalogue.png" />
        <span class="muted">{{ fileOf(target) }}</span>
        <NodePath class="path" :path="pathOf(target)" @nodeclick="pathClicked(target, $event)" />
        <button class="inputstyle small" @click="$emit('goto', target.node)">Go to</button>
      </div>

      <div v-for="(issue, j) in target.issues" :key="j" class="issue">{{ issue }}</div>
      <div v-if="target.status === 'in-data'" class="muted small">Nothing left to change: the data already holds what this entry sets.</div>

      <ul class="summaries">
        <li v-for="(s, j) in items" :key="j" :class="['summary', s.kind]">
          <span class="what">{{ s.label }}</span>
          <template v-if="s.segments">
            <div class="textdiff">
              <span v-for="(seg, k) in s.segments" :key="k" :class="seg.kind">{{ seg.text }}</span>
            </div>
          </template>
          <template v-else-if="s.lines">
            <div v-for="(line, k) in s.lines" :key="k" class="line" :style="{ paddingLeft: `${line.depth * 16}px` }">
              <img v-if="line.icon" class="typeIcon" :src="`assets/bsicons/${line.icon}.png`" />{{ line.text }}
            </div>
          </template>
          <template v-else>
            <span class="del">{{ s.before }}</span>
            <span class="arrow">→</span>
            <span class="add">{{ s.after }}</span>
          </template>
          <span v-if="s.present" class="muted small"> (already present)</span>
        </li>
      </ul>

      <details class="json" :open="!items.length">
        <summary>Before / after JSON</summary>
        <pre><span v-for="(line, j) in json" :key="j" :class="['jl', line.kind]">{{ line.kind === "add" ? "+ " : line.kind === "del" ? "- " : "  " }}{{ line.text }}</span></pre>
      </details>
    </section>

    <div class="decide">
      <input v-model="comment" class="comment" type="text" placeholder="Comment (optional, saved in the review file)" />
      <button class="bouton approve" :disabled="!row.targets.length" :title="approveTitle" @click="$emit('decide', 'approved', comment)">
        Approve
      </button>
      <button class="bouton reject" @click="$emit('decide', 'rejected', comment)">Reject</button>
      <button v-if="decision || changedSinceDecision" class="bouton" @click="$emit('clear')">Clear decision</button>
    </div>
    <p v-if="decision" class="muted small">
      {{ decision.status === "approved" ? "Approved" : "Rejected" }} {{ new Date(decision.date).toLocaleString() }}
      <template v-if="decision.comment"> — {{ decision.comment }}</template>
    </p>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { getAtEntryPath, getEntryPathInfo, getName, forEachEntryRecursive, type EntryPathEntry } from "~/assets/editor/bs_editor";
import { initializeSubtree } from "~/assets/editor/bs_initialize";
import {
  STATUS_LABELS,
  diffJson,
  noteParts,
  diffText,
  plainCopy,
  type DiffLine,
  type Json,
  type PatchChange,
  type ReviewRecord,
  type ReviewRow,
  type Segment,
  type TargetPreview,
} from "~/assets/editor/patch_review";
import { isDefaultObject } from "~/assets/shared/battlescribe/bs_helpers";
import type { Base } from "~/assets/shared/battlescribe/bs_main";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { setPrototype } from "~/assets/shared/battlescribe/bs_main_types";
import NodePath from "~/components/util/NodePath.vue";

interface Summary {
  kind: "cost" | "rename" | "text" | "field" | "added" | "removed" | "changed";
  label: string;
  before?: string;
  after?: string;
  segments?: Segment[];
  lines?: Array<{ icon?: string; text: string; depth: number }>;
  present?: boolean;
}

/** Child arrays a modifier or condition line is described with, as the search page's `by:logic` does. */
const LOGIC_KEYS = ["conditions", "conditionGroups", "localConditionGroups", "repeats", "modifiers", "modifierGroups"];
/** Keys whose change reads best as a word diff. */
const TEXT_KEYS = new Set(["$text", "description", "comment"]);

export default defineComponent({
  components: { NodePath },
  props: {
    row: { type: Object as PropType<ReviewRow>, required: true },
    decision: { type: Object as PropType<ReviewRecord>, required: false },
    changedSinceDecision: { type: Boolean, default: false },
    resolve: { type: Function as PropType<(id: string) => Base | undefined>, required: true },
  },
  emits: ["decide", "clear", "goto"],
  data() {
    return { comment: this.decision?.comment ?? "", STATUS_LABELS, noteParts };
  },
  computed: {
    /** Per target, computed once per row: summaries build detached previews. */
    views(): Array<{ target: TargetPreview; summaries: Summary[]; json: DiffLine[] }> {
      return this.row.targets.map((target) => ({ target, summaries: this.summaries(target), json: diffJson(target.before, target.after) }));
    },
    approveTitle(): string {
      if (this.row.status === "stale") return "Applies what still applies; the stale part is skipped";
      if (this.row.status === "in-data") return "Records the approval; there is nothing left to change";
      return "Applies this entry to the loaded data as an unsaved, undoable edit";
    },
  },
  methods: {
    live(node: Json): EditorBase {
      return node as unknown as EditorBase;
    },
    fileOf(target: TargetPreview): string {
      return this.live(target.node).getCatalogue?.()?.getName?.() ?? "";
    },
    pathOf(target: TargetPreview) {
      return getEntryPathInfo(this.live(target.node)).slice(1);
    },
    pathClicked(target: TargetPreview, payload: { path: EntryPathEntry[] }) {
      const catalogue = this.live(target.node).getCatalogue();
      const node = catalogue && getAtEntryPath(catalogue, payload.path);
      if (node) this.$emit("goto", node);
    },
    /** An id shows as the name it resolves to, anything else as itself. */
    display(value: unknown): string {
      if (value === undefined) return "(unset)";
      if (typeof value === "string") {
        const node = this.resolve(value);
        return node ? `${getName(node)}` : value;
      }
      return JSON.stringify(value);
    },
    /** A detached, initialized copy of `json` under `parent`, so getName can describe it before it exists. */
    preview(json: Json, key: string, parent: EditorBase): EditorBase {
      const copy = JSON.parse(JSON.stringify(json)) as Json;
      initializeSubtree({ [key]: [copy] }, { initialized: (n) => !isDefaultObject(n), initialize: setPrototype });
      const node = copy as unknown as EditorBase;
      const catalogue = (parent.catalogue ?? parent) as Catalogue;
      forEachEntryRecursive(node, (entry, _key, owner) => {
        entry.parent = (owner ?? parent) as EditorBase;
        entry.catalogue = catalogue;
        const link = entry as EditorBase & { targetId?: string; target?: Base };
        if (link.targetId && !link.target) link.target = this.resolve(link.targetId);
      });
      return node;
    },
    describe(node: EditorBase, depth = 0): Array<{ icon?: string; text: string; depth: number }> {
      const lines: Array<{ icon?: string; text: string; depth: number }> = [{ icon: node.editorTypeName, text: this.safeName(node), depth }];
      const record = node as unknown as Record<string, unknown>;
      for (const key of LOGIC_KEYS) {
        const list = record[key];
        if (Array.isArray(list)) for (const child of list) lines.push(...this.describe(child as EditorBase, depth + 1));
      }
      return lines;
    },
    safeName(node: EditorBase): string {
      try {
        return getName(node);
      } catch {
        return JSON.stringify(plainCopy(node));
      }
    },
    typeLabel(key: string): string {
      return key.replace(/^shared/, "").replace(/ies$/, "y").replace(/s$/, "").replace(/([A-Z])/g, " $1").toLowerCase();
    },
    summaries(target: TargetPreview): Summary[] {
      const out: Summary[] = [];
      const sets = new Map<Json, PatchChange[]>();
      for (const change of target.changes) {
        if (change.kind === "set") sets.set(change.owner, [...(sets.get(change.owner) ?? []), change]);
        else if (change.kind === "add") {
          const parent = this.live(change.owner);
          const node = this.preview(change.after as Json, change.key, parent);
          const where = change.owner === target.node ? "" : ` to ${this.safeName(parent)}`;
          out.push({ kind: "added", label: `${this.typeLabel(change.key)} added${where}`, lines: this.describe(node), present: change.present });
        } else if (change.element) {
          const node = this.live(change.element);
          out.push({ kind: "removed", label: `${this.typeLabel(change.key)} removed`, lines: this.describe(node) });
        }
      }
      for (const [owner, changes] of sets) {
        const node = this.live(owner);
        if (node.parentKey === "costs" && changes.length === 1 && changes[0].key === "value") {
          const cost = owner as { name?: string; typeId?: string };
          const name = cost.name ?? (cost.typeId && this.resolve(cost.typeId)?.getName()) ?? "cost";
          out.push({ kind: "cost", label: name, before: this.display(changes[0].before), after: this.display(changes[0].after) });
          continue;
        }
        if (owner !== target.node && !["characteristics", "costs"].includes(node.parentKey)) {
          // A modifier or condition reads best whole: its label before and after the edit.
          const after = { ...plainCopy(node), ...Object.fromEntries(changes.map((c) => [c.key, c.after])) };
          const edited = this.preview(after, node.parentKey, node.parent as EditorBase);
          out.push({ kind: "changed", label: `${this.typeLabel(node.parentKey)} changed`, before: this.safeName(node), after: this.safeName(edited) });
          continue;
        }
        const prefix = owner === target.node ? "" : `${this.safeName(node)}: `;
        for (const change of changes) {
          const text = typeof change.after === "string" && typeof change.before === "string";
          if (change.key === "name" && owner === target.node) {
            out.push({ kind: "rename", label: "renamed", before: String(change.before ?? ""), after: String(change.after ?? "") });
          } else if (text && (TEXT_KEYS.has(change.key) || String(change.after).length > 40)) {
            out.push({ kind: "text", label: `${prefix}${change.key}`, segments: diffText(String(change.before), String(change.after)) });
          } else {
            out.push({ kind: "field", label: `${prefix}${change.key}`, before: this.display(change.before), after: this.display(change.after) });
          }
        }
      }
      return out;
    },
  },
});
</script>

<style scoped lang="scss">
@use "@/shared_components/css/vars.scss" as *;

.detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.key {
  font-size: 13px;
}
.op {
  font-size: 12px;
  padding: 1px 6px;
  border: 1px solid $box_border;
  border-radius: 8px;
}
.muted {
  color: $gray;
}
.small {
  font-size: 12px;
}
.files {
  font-size: 12px;
}
.note {
  margin: 0;
  line-height: 1.4;
}
.status,
.decision {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 8px;
  color: #fff;
  background: $gray;
  &.applies {
    background: $blue;
  }
  &.stale {
    background: #b7791f;
  }
  &.in-data {
    background: #4a7c59;
  }
  &.no-match {
    background: $red;
  }
  &.approved {
    background: #2f855a;
  }
  &.rejected {
    background: #9b2c2c;
  }
  &.changed {
    background: #b7791f;
  }
}
.issue {
  padding: 6px 8px;
  border-left: 3px solid #b7791f;
  background: rgba(183, 121, 31, 0.12);
  font-size: 13px;
}
.target {
  border: 1px solid $box_border;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.where {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  .path {
    flex: 1;
    min-width: 0;
  }
}
.small.inputstyle,
.inputstyle.small {
  padding: 2px 8px;
  font-size: 12px;
}
.summaries {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.summary {
  font-size: 14px;
  .what {
    color: $gray;
    margin-right: 6px;
  }
  &.added .line {
    background: rgba(46, 160, 67, 0.15);
  }
  &.removed .line {
    background: rgba(248, 81, 73, 0.15);
    text-decoration: line-through;
  }
  .line {
    padding: 1px 4px;
  }
}
.del {
  background: rgba(248, 81, 73, 0.18);
  text-decoration: line-through;
}
.add {
  background: rgba(46, 160, 67, 0.2);
}
.arrow {
  margin: 0 6px;
  color: $gray;
}
.textdiff {
  white-space: pre-wrap;
  line-height: 1.4;
  padding: 4px 6px;
  border: 1px solid $box_border;
  .same {
    color: inherit;
  }
}
.json pre {
  margin: 4px 0 0;
  font-size: 12px;
  max-height: 360px;
  overflow: auto;
  border: 1px solid $box_border;
  padding: 4px 0;
}
.jl {
  display: block;
  padding: 0 6px;
  white-space: pre;
  &.gap {
    color: $gray;
    font-style: italic;
  }
  &.del {
    text-decoration: none;
  }
}
.decide {
  display: flex;
  gap: 6px;
  align-items: center;
  .comment {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
  }
}
.bouton.approve:not(:disabled) {
  border-color: #2f855a;
}
.bouton.reject {
  border-color: #9b2c2c;
}
.typeIcon {
  width: 16px;
  height: 16px;
  vertical-align: middle;
  margin-right: 4px;
}
</style>

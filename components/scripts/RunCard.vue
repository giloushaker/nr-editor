<template>
  <div class="card">
    <div class="head">
      <div class="ident">
        <div class="title">
          <span class="name">{{ script.name }}</span>
          <span class="source">{{ script.path ? filename(script.path) : "built-in" }}</span>
          <button v-if="script.path" class="bouton sm" @click="openFile">Open file</button>
        </div>
        <div v-if="script.description" class="desc">{{ script.description }}</div>
      </div>

      <!--
        A single argument sits on the head row, where it costs nothing. More than that and they
        crowd the description, so they go behind the disclosure instead and the card stays one
        line until you want to change something.
      -->
      <template v-if="inlineArgs">
        <ScriptArgument
          v-for="(arg, i) in argDefs"
          :key="i"
          compact
          :arg="arg"
          :args="args"
          :system="system"
          :index="i"
          :initial="savedArgs[argKey(arg, i)]"
          :ref="(el: any) => (argRefs[i] = el)"
        />
      </template>
      <button v-else-if="argDefs.length" class="bouton sm toggle" @click="argsOpen = !argsOpen">
        <span class="caret" :class="{ open: argsOpen }" />
        {{ argDefs.length }} arguments
      </button>

      <button v-if="!running" class="bouton run" @click="run">Run</button>
      <!--
        While it runs, Run becomes Stop. A script only actually stops where it awaits
        ctx.progress(), so the label says what it can promise and no more.
      -->
      <button v-else class="bouton run stop" @click="stopping = true" :disabled="stopping">
        {{ stopping ? "Stopping" : "Stop" }}
      </button>
    </div>

    <div v-if="running" class="progress">
      <div class="track">
        <!-- No max means the script is reporting steps without a total: show a full bar rather
             than pretending to know how far along it is. -->
        <div class="bar" :class="{ unknown: !progress?.max }" :style="barStyle" />
      </div>
      <span class="progresstext">{{ progressText }}</span>
    </div>

    <!--
      v-show, not v-if: run() reads the values off these components, so collapsing the panel must
      not unmount them -- it would take every argument with it and run the script on nothing.
    -->
    <div v-if="!inlineArgs && argDefs.length" v-show="argsOpen" class="argpanel">
      <ScriptArgument
        v-for="(arg, i) in argDefs"
        :key="i"
        compact
        labelWidth="96px"
        :arg="arg"
        :args="args"
        :system="system"
        :index="i"
        :initial="savedArgs[argKey(arg, i)]"
        :ref="(el: any) => (argRefs[i] = el)"
      />
    </div>

    <!--
      One accordion per card, rather than one open script at a time, so several results can stay
      open at once. It appears only once there is something to open.
    -->
    <div v-if="hasRun" class="accordion" :class="{ open }" @click="open = !open">
      <img class="arrow icon" :class="{ open }" src="/assets/icons/right2.png" alt="" />
      <span class="bold">Output</span>
    </div>

    <div v-if="hasRun && open" class="output">
      <div v-for="(piece, i) of outputArray" :key="i" class="output-element">
        <template v-if="['string', 'number'].includes(typeof piece)">
          <span class="output-html" v-html="piece" />
        </template>
        <template v-else-if="Array.isArray(piece) && isEntryList(piece)">
          <div v-for="(node, j) in piece" :key="j" class="node">
            <template v-if="Array.isArray(node)">
              <NodePath
                :path="path(node[0])"
                :text="node[1]"
                class="hover-darken cursor-pointer p-1px"
                @click="store.goto(node[0])"
              />
            </template>
            <template v-else>
              <NodePath :path="path(node)" class="hover-darken cursor-pointer p-1px" @click="store.goto(node)" />
            </template>
          </div>
        </template>
        <template v-else-if="isEntry(piece)">
          <NodePath :path="path(piece)" class="hover-darken cursor-pointer p-1px" @click="store.goto(piece)" />
        </template>
        <template v-else-if="isError(piece)">
          <div class="error">{{ piece }}</div>
        </template>
        <template v-else>
          <pre>{{ JSON.stringify(piece, null, 2) }}</pre>
        </template>
      </div>
      <div v-if="!outputArray.length" class="muted">Nothing to report.</div>
    </div>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import ScriptArgument from "./ScriptArgument.vue";
import NodePath from "../util/NodePath.vue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { getEntryPathInfo } from "~/assets/editor/bs_editor";
import { filename, openPath } from "~/electron/node_helpers";
import { useEditorStore } from "~/stores/editorStore";
import type { ScriptArg, ScriptDef, ScriptProgress } from "~/stores/scriptsStore";

/**
 * Above this many, the arguments go behind the disclosure rather than onto the head row.
 *
 * One. Two already crowd the row against a long description and push Run around.
 */
const INLINE_LIMIT = 1;

export default defineComponent({
  components: { ScriptArgument, NodePath },
  props: {
    script: { type: Object as PropType<ScriptDef>, required: true },
    system: { type: GameSystemFiles, required: true },
  },
  setup() {
    return { store: useEditorStore(), filename };
  },
  data() {
    return {
      result: null as unknown,
      args: [],
      argRefs: [] as any[],
      running: false,
      stopping: false,
      progress: null as ScriptProgress | null,
      open: false,
      argsOpen: false,
      hasRun: false,
    };
  },
  computed: {
    argDefs(): ScriptArg[] {
      return this.script.arguments ?? [];
    },
    savedArgs(): Record<string, any> {
      return this.store.scripts.saved_args(this.system.gameSystem?.gameSystem?.id, this.script);
    },
    progressText(): string {
      const p = this.progress;
      if (!p) return "Running...";
      const count = p.max ? `${p.current} / ${p.max}` : String(p.current);
      return p.message ? `${count} · ${p.message}` : count;
    },
    barStyle(): Record<string, string> {
      const p = this.progress;
      if (!p?.max) return {};
      return { width: `${Math.min(100, Math.round((p.current / p.max) * 100))}%` };
    },
    inlineArgs(): boolean {
      return this.argDefs.length > 0 && this.argDefs.length <= INLINE_LIMIT;
    },
    outputArray(): unknown[] {
      const value = Array.isArray(this.result) && !this.isEntryList(this.result) ? this.result : [this.result];
      return value.filter((o) => {
        if (Array.isArray(o) && o.length === 0) return false;
        return o !== null && o !== undefined;
      });
    },
  },
  methods: {
    isEntry(entry: unknown): entry is EditorBase {
      return entry instanceof Base;
    },
    isError(piece: unknown): piece is Error {
      return piece instanceof Error;
    },
    isEntryWithDesc(arr: unknown) {
      return Array.isArray(arr) && arr.length === 2 && this.isEntry(arr[0]);
    },
    isEntryList(lst: unknown[]): lst is EditorBase[] {
      if (lst.find((o) => !this.isEntry(o) && !this.isEntryWithDesc(o))) return false;
      return lst.length > 0;
    },
    path(base: EditorBase) {
      return getEntryPathInfo(base);
    },
    /** Arguments are remembered by name; the index is the fallback for an unnamed one. */
    argKey(arg: ScriptArg, i: number): string {
      return arg.name ?? String(i);
    },
    async run() {
      this.result = null;
      this.running = true;
      this.stopping = false;
      this.progress = null;
      // One tick, so the button repaints as Stop before a synchronous script blocks the thread.
      await new Promise((resolve) => setTimeout(resolve, 1));
      try {
        const widgets = this.argRefs.filter(Boolean);
        const args = await Promise.all(widgets.map((o) => o.getArgument()));

        // Remembered before the run, not after: a script that throws halfway was still run with
        // these, and having to retype them to retry is the worst moment to lose them.
        const remembered: Record<string, any> = {};
        this.argDefs.forEach((arg, i) => {
          const value = widgets[i]?.rawValue();
          if (value !== undefined) remembered[this.argKey(arg, i)] = value;
        });
        this.store.scripts.save_args(this.system, this.script, remembered);

        const ctx = this.store.scripts.run_context(
          (p) => (this.progress = p),
          () => this.stopping,
        );
        // Through the store, so a script touching 400 nodes is still one Ctrl+Z. It reports and
        // returns a thrown error rather than rethrowing, which is what gets rendered below.
        // ctx goes last, after the declared arguments, so existing run(a, b) signatures are unchanged.
        this.result = await this.store.scripts.invoke(this.script.name, () =>
          this.script.run!(...args, ctx),
        );
      } finally {
        this.running = false;
        this.stopping = false;
        this.progress = null;
        this.hasRun = true;
        this.open = true;
      }
    },
    async openFile() {
      try {
        if (!(await openPath(this.script.path!))) {
          notify({ type: "error", text: "Opening files needs the desktop app." });
        }
      } catch (e) {
        notify({ type: "error", text: `Could not open the file: ${(e as Error).message}` });
      }
    },
  },
});
</script>

<style lang="scss" scoped>
@use "@/shared_components/css/vars.scss" as *;

/**
 * No background of its own.
 *
 * It used $input_background -- the same token the inputs use -- so on either theme a field was
 * separated from its card by nothing but a hairline border. Letting the page show through is also
 * what the app's own `.box` does.
 */
.card {
  border: 1px solid $box_border;
  box-shadow: $box_shadow;
}

.head {
  padding: 9px 12px;
  display: flex;
  /* Top, not centre: against a three-line description, centred controls float halfway down the
     card with nothing to line up against. */
  align-items: flex-start;
  gap: 10px;
}

.ident {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title {
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.name {
  font-size: 15px;
  font-weight: bold;
}

/* Opacity rather than `.gray`, which is a hardcoded #808080 and fails on the dark theme's #333. */
.source {
  font-size: 11.5px;
  font-family: monospace;
  opacity: 0.7;
}

/* Below the name, at full width: it was truncated onto the title line with an ellipsis. */
/**
 * Secondary to the name, and the SAME muting on both card types -- they drifted apart before
 * (0.85 here, none there), which is what made the two halves of the page look inconsistent.
 *
 * 0.85 of the theme's #ababab over #2b2b2b lands at ~4.9:1: muted, still above AA. Any lower and
 * the descriptions stop being readable on the dark theme. Change one, change the other.
 */
.desc {
  font-size: 13px;
  line-height: 1.45;
  opacity: 0.85;
  /* pre-line, so a 
 in a description is a line break and runs of spaces still
     collapse. The text is interpolated, not v-html, so <br> would render literally. */
  white-space: pre-line;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

/* Drawn, not an <img>: `.bouton > img` is positioned absolutely by the global stylesheet. */
.caret {
  width: 0;
  height: 0;
  flex: none;
  border-left: 5px solid currentColor;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  transition: transform 0.12s ease;

  &.open {
    transform: rotate(90deg);
  }
}

.argpanel {
  border-top: 1px solid $box_border;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.run {
  min-width: 74px;
  font-weight: bold;
  flex: none;

  &:disabled {
    font-weight: normal;
    opacity: 0.6;
  }
}

.stop {
  border-color: $red;
}

.progress {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 12px 9px;
}

.track {
  flex: 1;
  height: 5px;
  background-color: rgba(125, 125, 125, 0.25);
  overflow: hidden;
}

.bar {
  height: 100%;
  width: 100%;
  background-color: $blue;
  transition: width 0.1s linear;

  /* No total to divide by, so it pulses rather than claiming a position. */
  &.unknown {
    animation: script-progress-pulse 1.1s ease-in-out infinite;
  }
}

@keyframes script-progress-pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

.progresstext {
  font-size: 12px;
  opacity: 0.8;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.accordion {
  border-top: 1px solid $box_border;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;

  /* Translucent grey, so it lightens a dark theme and darkens a light one. */
  &:hover {
    background-color: rgba(125, 125, 125, 0.15);
  }

  &.open {
    background-color: rgba(125, 125, 125, 0.22);
  }
}

.arrow {
  width: 13px;
  height: 13px;
  flex: none;
  transition: transform 0.12s ease;

  &.open {
    transform: rotate(90deg);
  }
}

.output {
  padding: 6px 12px 10px;
  max-height: 420px;
  overflow-y: auto;

  .node {
    padding: 1px 0;
  }

  pre {
    font-size: 12.5px;
  }
}

.muted {
  opacity: 0.75;
}

.error {
  color: $red;
}

/**
 * Secondary buttons take the card's text colour, not the global one.
 *
 * `html.dark .bouton` in style.scss forces every button's label to pure #ffffff, which against
 * the card's #ababab reads as bold even though .bouton is font-weight 400. The border is enough
 * affordance for these; Run keeps the emphasis because it is the action.
 */
.bouton.sm {
  padding: 3px 9px;
  font-size: 12px;
  font-weight: normal;
  color: inherit;
}
</style>

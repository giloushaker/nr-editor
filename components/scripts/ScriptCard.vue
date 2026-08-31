<template>
  <div class="card" :class="{ off: !enabled, broken: script.error }">
    <!-- A broken script has no switch: there is nothing loaded to turn on. -->
    <img v-if="script.error" class="warn" src="/assets/icons/warning_sign.png" alt="failed" />
    <button
      v-else
      class="switch"
      :class="{ on: enabled }"
      role="switch"
      :aria-checked="enabled"
      :title="enabled ? 'Switch off' : 'Switch on'"
      @click="store.scripts.set_enabled(system, script, !enabled)"
    >
      <i />
    </button>

    <div class="body">
      <div class="head">
        <span class="name">{{ script.name }}</span>
        <span class="source">{{ script.path ? filename(script.path) : "built-in" }}</span>
        <button v-if="script.path" class="bouton sm" @click="open">Open file</button>
      </div>

      <template v-if="script.error">
        <div class="mono err">{{ String(script.error) }}</div>
        <div class="note">
          Nothing it declares is registered while it is broken. Fix the file and save it; the editor
          reloads it on its own.
        </div>
      </template>

      <template v-else>
        <div v-if="script.description" class="desc">{{ script.description }}</div>

        <!--
          Chips alone. Each was paired with a line explaining what that hook does, but the editor
          only knows a script registered `context`, never what it puts there, so the line said the
          same thing for every script that used it.
        -->
        <div class="chips">
          <span v-for="chip of chips" :key="chip.label" class="chip" :class="{ check: chip.check }">
            {{ chip.label }}
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { filename, openPath } from "~/electron/node_helpers";
import { useEditorStore } from "~/stores/editorStore";
import type { ScriptDef } from "~/stores/scriptsStore";

export default defineComponent({
  props: {
    script: { type: Object as PropType<ScriptDef>, required: true },
    system: { type: GameSystemFiles, required: true },
  },
  setup() {
    return { store: useEditorStore(), filename };
  },
  computed: {
    enabled(): boolean {
      return this.store.scripts.is_enabled(this.system.gameSystem?.gameSystem?.id, this.script);
    },
    chips(): Array<{ label: string; check?: boolean }> {
      const result = [];
      const rules = this.script.diagnostics?.length ?? 0;
      if (rules) result.push({ label: `${rules} check${rules > 1 ? "s" : ""}`, check: true });
      for (const hook of Object.keys(this.script.hooks ?? {})) result.push({ label: hook });
      return result;
    },
  },
  methods: {
    async open() {
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

/* No background of its own -- see RunCard: $input_background is the inputs' token, not a surface. */
.card {
  border: 1px solid $box_border;
  box-shadow: $box_shadow;
  padding: 10px 12px;
  display: flex;
  gap: 11px;
  align-items: flex-start;

  /* Greyscale kills the chips' colour, which is the signal; the text stays legible. */
  &.off {
    filter: grayscale(100%);
    opacity: 0.8;
  }

  &.broken {
    border-color: $red;
  }
}

.warn {
  width: 20px;
  flex: none;
  margin-top: 2px;
}

/**
 * A pill switch rather than a checkbox: this is the one control on the page whose whole job is
 * "on or off, right now", and it has to read as that from across the card grid.
 */
.switch {
  width: 34px;
  height: 19px;
  border-radius: 10px;
  border: none;
  padding: 0;
  flex: none;
  margin-top: 2px;
  position: relative;
  cursor: pointer;
  background-color: #bbbbbb;

  &.on {
    background-color: $blue;
  }

  > i {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 15px;
    height: 15px;
    border-radius: 8px;
    background-color: #ffffff;
    display: block;
    transition: left 0.12s ease;
  }

  &.on > i {
    left: 17px;
  }
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.name {
  font-size: 15px;
  font-weight: bold;
}

/**
 * Muted with opacity rather than a grey.
 *
 * The global `.gray` is a hardcoded #808080, which lands at under 3:1 on the dark theme's #333
 * surfaces -- that is why this text was hard to read. Opacity mutes toward whatever the surface
 * actually is, so it holds in both themes.
 */
.source {
  margin-left: auto;
  font-size: 11.5px;
  font-family: monospace;
  opacity: 0.7;
}

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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding-top: 1px;
}

.chip {
  border: 1px solid $box_border;
  border-radius: 3px;
  padding: 3px 6px;
  font-size: 11.5px;
  line-height: 1;
  white-space: nowrap;
  opacity: 0.85;

  &.check {
    opacity: 1;
    border-color: $blue;
    color: $blue;
  }
}

.note {
  font-size: 12px;
  opacity: 0.7;
}

.err {
  font-family: monospace;
  font-size: 12.5px;
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

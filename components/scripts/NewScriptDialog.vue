<template>
  <PopupDialog v-model="shown" x text="Cancel" slotstyle="width: 900px; max-width: 92vw" @close="$emit('close')">
    <template #header>New script</template>

    <div class="rows">
      <div class="row">
        <label class="field" for="new-script-name">Name</label>
        <input id="new-script-name" type="text" v-model="name" spellcheck="false" class="namefield" />
        <span class="mono file">&rarr; scripts/{{ file }}</span>
      </div>

      <div class="row top">
        <label class="field">Start from</label>
        <div class="templates">
          <!--
            The templates are the discovery mechanism. Nobody guesses "diagnostics" or "panel"
            from a blank file, and the reference is a page away.
          -->
          <div
            v-for="option of TEMPLATES"
            :key="option.id"
            class="template"
            :class="{ on: template === option.id }"
            @click="template = option.id"
          >
            <b>{{ option.label }}</b>
            <span class="hint">{{ option.hint }}</span>
          </div>
        </div>
      </div>

      <div class="row top">
        <label class="field">Preview</label>
        <div class="preview">
          <pre>{{ code }}</pre>
          <div class="note">
            Every hook is listed at the bottom of the Scripts page. This file reloads itself each
            time you save it.
          </div>
        </div>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
      <div v-else class="note foot">
        Creates <span class="mono">{{ folder || "the system's scripts folder" }}</span> if it does not exist yet.
      </div>
    </div>

    <template #boutons>
      <button class="bouton" :disabled="!name.trim() || busy" @click="create(false)">Create</button>
      <button class="bouton" :disabled="!name.trim() || busy" @click="create(true)">Create and open</button>
    </template>
  </PopupDialog>
</template>

<script lang="ts">
import type { PropType } from "vue";
import PopupDialog from "~/shared_components/PopupDialog.vue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { openPath } from "~/electron/node_helpers";
import { useEditorStore } from "~/stores/editorStore";
import type { ScriptDef } from "~/stores/scriptsStore";

const TEMPLATES = [
  { id: "blank", label: "Blank", hint: "a name and a run()" },
  { id: "check", label: "A check", hint: "flags bad data in the tree" },
  { id: "context", label: "Menu action", hint: "an item in the right-click menu" },
  { id: "save", label: "On save", hint: "fixes the file on its way out" },
];

/** `\${` throughout: these are the script's own template literals, not this component's. */
function body(id: string, name: string, slug: string): string {
  switch (id) {
    case "check":
      return `  diagnostics: [
    {
      id: "${slug}",
      severity: "warning",

      // Cheap gate -- unrelated nodes skip check() entirely.
      applies: (node) => node.isEntry(),

      // Return a message when the node is wrong, nothing when it is fine.
      // Never add or clear errors yourself; the engine reconciles.
      check(node) {
        if (!node.getCosts().length) {
          return \`\${node.getName()} has no cost\`
        }
      },
    },
  ],`;

    case "context":
      return `  hooks: {
    // Runs on every right-click in the tree. Return nothing to stay hidden.
    // "group" places it in the menu; an unknown one lands in the Scripts submenu.
    context(event, { selections, catalogues }) {
      if (!selections.length) return
      return {
        label: "${name}",
        group: "edit",
        run: () => {
          for (const node of selections) {
            $store.edit_node(node, { comment: "todo: check this" })
          }
        },
      }
    },
  },`;

    case "save":
      return `  hooks: {
    // Awaited before the catalogue is written, so anything changed here lands in the file.
    async save(event, { catalogue, system }) {
      console.log("about to save", catalogue.name)
    },
  },`;

    default:
      return `  arguments: [
    { name: "catalogues", type: "catalogue[]" },
  ],

  // Return a string, a node, or a list of either. Strings are rendered as html,
  // nodes become links you can click to open them in the editor.
  run(catalogues) {
    const found = []
    for (const catalogue of catalogues) {
      catalogue.forEachObjectWhitelist((node) => {
        if (node.isEntry() && !node.getCosts().length) found.push(node)
      })
    }
    return [\`<b>\${found.length}</b> entries with no cost:\`, found]
  },`;
  }
}

export default defineComponent({
  components: { PopupDialog },
  emits: ["close", "created"],
  props: {
    system: { type: GameSystemFiles, required: true },
    /** Prefills the name, so an empty page can offer a starting point. */
    suggested: { type: String as PropType<string>, default: "" },
  },
  setup() {
    return { store: useEditorStore(), TEMPLATES };
  },
  data() {
    return {
      shown: true,
      name: this.suggested,
      template: "check",
      busy: false,
      error: "",
    };
  },
  computed: {
    folder(): string | undefined {
      return this.store.scripts.script_folder(this.system);
    },
    /** Kept separate from the name so renaming a script never renames its file behind your back. */
    slug(): string {
      return (
        this.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "script"
      );
    },
    file(): string {
      return `${this.slug}.js`;
    },
    code(): string {
      const name = this.name.trim() || "Untitled";
      return `export default {
  name: "${name.replace(/"/g, '\\"')}",
  description: "",

${body(this.template, name, this.slug)}
}
`;
    },
  },
  methods: {
    async create(andOpen: boolean) {
      this.busy = true;
      this.error = "";
      try {
        const script = (await this.store.scripts.write_script(this.system, this.file, this.code)) as ScriptDef;
        this.$emit("created", script);
        // Best effort: on the web there is no "open in your editor", and that is not a failure
        // worth blocking the create on -- the file is written either way.
        if (andOpen && script.path) {
          if (!(await openPath(script.path))) {
            notify("Created. Opening it needs the desktop app.");
          }
        } else {
          notify(`Created ${this.file}`);
        }
        this.shown = false;
      } catch (e) {
        this.error = (e as Error).message;
      } finally {
        this.busy = false;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
@use "@/shared_components/css/vars.scss" as *;

.rows {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;

  &.top {
    align-items: flex-start;
  }
}

.field {
  width: 90px;
  flex: none;
  font-size: 13.5px;
  font-weight: bold;
  padding-top: 4px;
}

.namefield {
  width: 300px;
}

.file {
  font-size: 12px;
  opacity: 0.75;
}

.templates {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.template {
  border: 1px solid $box_border;
  background-color: $input_background;
  padding: 8px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;

  /**
   * Selection is a border plus the tree's own neutral highlight, not a colour fill.
   *
   * It filled with $light_blue, which is #009cbd on the dark theme -- a saturated cyan that the
   * hint text (and the global .gray, a hardcoded #808080) was unreadable against. A translucent
   * grey darkens or lightens with whatever surface is behind it, so it works in both themes.
   */
  &.on {
    border-color: $blue;
    background-color: rgba(125, 125, 125, 0.25);
    box-shadow: inset 0 0 0 1px $blue;
  }

  > b {
    font-size: 13.5px;
  }

  > .hint {
    font-size: 12px;
    line-height: 1.4;
    opacity: 0.75;
  }
}

.preview {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

pre {
  margin: 0;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.6;
  border: 1px solid $box_border;
  background-color: $input_background;
  padding: 9px 11px;
  max-height: 330px;
  overflow: auto;
  white-space: pre;
}

.note {
  font-size: 12px;
  opacity: 0.75;
}

.foot {
  padding-left: 100px;
}

.mono {
  font-family: monospace;
}

.error {
  color: $red;
  padding-left: 100px;
  font-size: 13px;
}
</style>

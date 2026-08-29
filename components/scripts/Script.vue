<template>
  <details class="script mx-4px" @toggle="opened = true">
    <summary>{{ script.name }}</summary>
    <div v-if="opened" class="content">
      <span v-if="script.description">Description:</span><span class="gray">{{ script.description }}</span>
      <div v-for="(arg, i) in script.arguments || []">
        <ScriptArgument :arg="arg" :args="args" :system="system" :index="i" ref="args" />
      </div>
      <div>
        <button class="bouton run-script my-10px" @click="run" :disabled="running">
          <template v-if="running">
            <span class="gray">Running...</span>
          </template>
          <template v-else>
            <img class="icon run-script-icon" src="/assets/icons/right2.png" alt="" />
            <span>Run Script</span>
          </template>
        </button>
      </div>
      <template v-if="result">
        <div class="bold">Output:</div>

        <div v-for="piece of outputArray" class="output-element">
          <template v-if="['string', 'number'].includes(typeof piece)">
            <span class="output-html" v-html="piece"> </span>
          </template>
          <template v-else-if="Array.isArray(piece) && isEntryList(piece)">
            <div v-for="node in piece" class="node">
              <template v-if="Array.isArray(node)">
                <NodePath :path="path(node[0])" @click="store.goto(node[0])" class="hover-darken cursor-pointer p-1px" :text="node[1]"/>
              </template>
              <template v-else>
                <NodePath :path="path(node)" @click="store.goto(node)" class="hover-darken cursor-pointer p-1px" />
              </template>
            </div>
            <!-- <div v-if="piece.length > 100">
              <span class="gray"> ({{ piece.length - 100 }} hidden) </span>
            </div> -->
          </template>
          <template v-else-if="isEntry(piece)">
            <NodePath :path="path(piece)" @click="store.goto(piece)" class="hover-darken cursor-pointer p-1px" />
          </template>
          <template v-else-if="isError(piece)">
            <div class="error">{{ piece }}</div>
          </template>
          <template v-else>
            <pre>
              {{ JSON.stringify(piece, null, 2) }}
            </pre>
          </template>
        </div>
        <div v-if="outputArray.length == 0">
          <span class="gray">None</span>
        </div>
      </template>
    </div>
  </details>
</template>
<script lang="ts">
import type { PropType } from "vue";
import ScriptArgument from "./ScriptArgument.vue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { getEntryPathInfo } from "~/assets/editor/bs_editor";
import { useEditorStore } from "~/stores/editorStore";
import NodePath from "../util/NodePath.vue";
export default defineComponent({
  components: { ScriptArgument, NodePath },

  props: {
    script: {
      type: Object as PropType<{
        name: string;
        run: Function;
        description?: string;
        arguments?: {
          name: string;
          type: string | string[];
        };
        hooks: Record<string, Function>;
      }>,
      required: true,
    },
    system: {
      type: GameSystemFiles,
      required: true,
    },
  },
  setup() {
    return { store: useEditorStore() };
  },
  data() {
    return { result: null as unknown, args: [], running: false, opened: false };
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
      if (lst.find((o) => !this.isEntry(o) && !this.isEntryWithDesc(o))) {
        return false;
      }
      return lst.length > 0;
    },
    async run() {
      this.result = null;
      this.running = true;
      await new Promise((resolve) => setTimeout(resolve, 1));
      try {
        const args = this.$refs.args ? await Promise.all((this.$refs.args as any[]).map((o) => o.getArgument())) : [];
        this.store.scripts.add_script_hooks(this.script);
        if (typeof this.script.run === "function") {
          this.result = await this.script.run(...args);
        } else if (this.script.hooks) {
          this.result = `Added hooks: ${Object.keys(this.script.hooks)}`;
        } else {
          this.result = null;
        }
        console.log(this.script.name, this.result);
      } catch (e) {
        console.error(e);
        console.log(typeof e, e instanceof Error);
        this.result = e;
      } finally {
        this.running = false;
      }
    },
    path(base: EditorBase) {
      const path = getEntryPathInfo(base);
      return path;
    },
    other_path(link: EditorBase) {
      return getEntryPathInfo(link);
    },
  },
  computed: {
    outputArray() {
      return (Array.isArray(this.result) && !this.isEntryList(this.result) ? this.result : [this.result]).filter(
        (o) => {
          if (Array.isArray(o) && o.length === 0) return false;
          if (o === null) return false;
          if (o === undefined) return false;
          return true;
        }
      );
    },
  },
});
</script>
<style lang="scss" scoped>
@use "@/shared_components/css/vars.scss" as *;

.script {
  margin-top: 2px;
  border: 1px solid $box_border;

  > summary {
    cursor: pointer;
    padding: 5px;
    font-size: $fontHeaderSize;
  }

  > .content {
    padding: 5px;
  }
}

/**
 * The icon is a 20x20 png and `.icon` carries no sizing globally, so as a plain inline
 * image it sat on the text baseline and overflowed the button's default padding. Lay the
 * button out as a flex row and bound the icon to the line height instead.
 */
.run-script {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 5px 12px;
  line-height: 1.2;
  min-height: 30px;
}

.run-script-icon {
  display: block;
  width: 1.1em;
  height: 1.1em;
  flex: none;
}
</style>

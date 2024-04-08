<template>
  <CollapsibleBox class="script mx-4px">
    <template #title>
      {{ script.name }}
    </template>
    <template #content>
      <div v-for="(arg, i) in script.arguments || []">
        <ScriptArgument :arg="arg" :args="args" :system="system" :index="i" ref="args" />
      </div>
      <div>
        <button class="bouton my-10px" @click="run" :disabled="running">
          <template v-if="running">
            <span class="gray">...</span>
          </template>
          <template v-else>
            <img src="/assets/icons/right2.png" />
            Run Script
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
                <NodePath
                  :path="path(node[0])"
                  @click="store.goto(node[0])"
                  class="hover-darken cursor-pointer p-1px"
                  :text="node[1]"
                  @click.middle="debug(node[0].editorTypeName, node[0])"
                />
              </template>
              <template v-else>
                <NodePath
                  :path="path(node)"
                  @click="store.goto(node)"
                  class="hover-darken cursor-pointer p-1px"
                  @click.middle="debug(node.editorTypeName, node)"
                />
              </template>
            </div>
            <!-- <div v-if="piece.length > 100">
              <span class="gray"> ({{ piece.length - 100 }} hidden) </span>
            </div> -->
          </template>
          <template v-else-if="isEntry(piece)">
            <NodePath
              :path="path(piece)"
              @click="store.goto(piece)"
              class="hover-darken cursor-pointer p-1px"
              @click.middle="debug(piece.editorTypeName, piece)"
            />
          </template>
          <template v-else="piece">
            <pre>
              {{ JSON.stringify(piece, null, 2) }}
            </pre>
          </template>
        </div>
        <div v-if="outputArray.length == 0">
          <span class="gray">None</span>
        </div>
      </template>
    </template>
  </CollapsibleBox>
</template>
<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import ScriptArgument from "./ScriptArgument.vue";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { getEntryPathInfo } from "~/assets/shared/battlescribe/bs_editor";
import { useEditorStore } from "~/stores/editorStore";
import NodePath from "../util/NodePath.vue";
export default defineComponent({
  components: { ScriptArgument, NodePath },

  props: {
    script: {
      type: Object as PropType<{
        name: string;
        run: Function;
        arguments?: {
          name: string;
          type: string | string[];
        };
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
    return { result: null as any, args: [], running: false };
  },
  methods: {
    debug(...args: any[]) {
      console.log(...args);
    },
    isEntry(entry: any) {
      return entry instanceof Base;
    },
    isEntryWithDesc(arr: any) {
      return Array.isArray(arr) && arr.length === 2 && this.isEntry(arr[0]);
    },
    isEntryList(lst: Array<any>) {
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
        this.result = e;
      } finally {
        globalThis.$result = this.result;
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
<style lang="scss">
@import "@/shared_components/css/vars.scss";

.script {
  margin-top: 2px;
  border: 1px solid $box_border;
}
:deep(.title) {
  background-color: blue;
}
</style>

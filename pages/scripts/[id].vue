<template>
  <div class="h-full overflow-y-auto">
    <template v-if="system">
      <div v-for="script in scripts"> <RunScript :script="script" :system="system" /> </div>
    </template>
    <CollapsibleBox>
      <template #title>Info</template>
      <template #content>
        <div class="info">
          <pre style="margin: 10px">
Note: this feature is not finished To add a new script: Create a folder named `scripts` in your data folder and
add a .js file with content like this:
<code>
export default {
  name: "Display Selected",
  description: "Returns the currently selected node(s)",
  arguments: [
    {
      name: "catalogues",
      type: "catalogue[]"
    },
    {
      name: "query",
      type: "string"
      optional: true,
    },
  ],
  run(catalogues, query) {
    return [`&lt;span style="font-weight: bold"&gt;Selected nodes:&lt;/span&gt;`,$store.get_selections()]
  }
}
</code>
<span class="bold">Output:</span>
return one of or an array of: number | error | string | node[] | [node, string][]
Will render html

<span class="bold">Running scripts:</span>
Currently only supports running scripts manually, but may support running hooks in the future such as on paste, on change, on load, etc
You may interact with the editor using the store (global variable `$store`, also available in the console)
Available actions are in <a href="https://github.com/giloushaker/nr-editor/blob/master/stores/editorStore.ts">https://github.com/giloushaker/nr-editor/blob/master/stores/editorStore.ts</a>
Example scripts (in typescript but only js is supported for non-default scripts): <a href="https://github.com/giloushaker/nr-editor/tree/master/default-scripts">https://github.com/giloushaker/nr-editor/tree/master/default-scripts</a>
If you want to use imports you have to bundle them into one js file with rollup/webpack
If you want to read/write local files you can use the functions in the global `$node`
          </pre>
        </div>
      </template>
    </CollapsibleBox>
  </div>
</template>

<script lang="ts">
import { getDataObject } from "~/assets/shared/battlescribe/bs_main";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import RunScript from "~/components/scripts/Script.vue";
import { useEditorStore } from "~/stores/editorStore";

export default defineComponent({
  components: { RunScript },
  setup() {
    return { store: useEditorStore() };
  },
  data() {
    const store = useEditorStore();
    return {
      system: null as GameSystemFiles | null,
      scripts: [...store.scripts.get_default_scripts()],
    };
  },
  async mounted() {
    this.system = null;
    this.system = await this.store.get_or_load_system((this.$route.params as { id: string }).id);
    this.scripts.push(...(await this.store.scripts.get_scripts(this.system)));
  },
  methods: {},
});
</script>

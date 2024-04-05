<template>
  <div class="h-full overflow-y-auto">
    <template v-if="system">
      <div v-for="script in scripts"> <RunScript :script="script" :system="system" /> </div>
    </template>
    <pre clas="info">
Note: this feature is not finished To add a new script: Create a folder named `scripts` in your data folder and
add a .js file with content like this:
`
export default {
  name: "name",
  description: "description",
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
    return [$store.]
  }
}
`
Output: 
one of or an array of: number | error | string | node[] | [node, string][]
The editor attempts tries to display the output:
You can return an array to display multiple things
To display a node, simply return an array of them
To display text next to a node, return an array containing the node and a string
Will render html

Running scripts:
Currently only supports running scripts manually, but may support running hooks such as on paste, on change, on load, etc
You may interact with the editor using the store (global variable `$store`, also available in the console)
Available actions are in https://github.com/giloushaker/nr-editor/blob/master/stores/editorStore.ts
Example scripts (in typescript but only js is supported for non-default scripts) 
    </pre>
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

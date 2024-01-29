<template>
    <div class="ml-20px mt-10px h-full overflow-y-auto">
        <!-- Params:
      {{ $route.params }} -->

        <pre>
This tab is used to run scripts:
Scripts will be able to export certain methods:

// Returns the entries that the script should select, allowing the user to preview what would be changed by modify()
select()

// Modifies the entries provided, wich is what is returned by select, or user-provided entries.
// returns: a list of changes to apply (so that they may be viewed by the user)
// Possible changes:
// - overwrite (path, Record&lt;string, value&gt;)
// - set (path, field, value)
// - add (path, nodes)
// - remove (path)
modify(catalogues, entries)

// Returns a list of errors to display to the user
check(catalogues, entries)

// Documenting your script:
// export `readme` to display documentation for your script
// export an object as `docs` with the key:value pairs corresponding to a function (such as `select`, `modify`,
`check`)
        </pre>
    </div>
</template>
  
<script lang="ts">
import { useEditorStore } from "~/stores/editorStore";

export default defineComponent({
    setup() {
        return { store: useEditorStore() };
    },
    data() {
        return {
        };
    },
    computed: {
        async system() {
            return await this.store.get_or_load_system((this.$route.params as { id: string; }).id);
        },

    },
    methods: {
    },
});
</script>
  
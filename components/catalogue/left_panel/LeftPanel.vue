<template>
  <div class="leftPanel">
    <div class="top" @keydown.capture="keydown">
      <CatalogueEntry :item="catalogue" grouped id="editor-entries" />
    </div>
    <div class="bottom">
      <input v-model="storeFilter" type="search" placeholder="search..." class="w-full" />
    </div>
  </div>
</template>

<script lang="ts">
import { forEachParent } from "~/assets/shared/battlescribe/bs_editor";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorState";

export default {
  setup() {
    return { store: useEditorStore() };
  },

  mounted() {
    addEventListener("keydown", this.keydown);
  },
  unmounted() {
    removeEventListener("keydown", this.keydown);
  },
  data() {
    return {
      filtered: [] as EditorBase[],
    };
  },
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
  methods: {
    keydown(e: KeyboardEvent) {
      if (!e.target) return;
      const target = (e.target as HTMLDivElement).tagName;
      if (target !== "BODY") return;

      if (e.ctrlKey && e.key.toLowerCase() === "z") {
        this.store.undo();
      }

      if (e.ctrlKey && e.key.toLowerCase() === "y") {
        this.store.redo();
      }

      if (e.ctrlKey && e.key.toLowerCase() === "x") {
        this.store.set_clipboard(this.store.get_selections());
        this.store.remove();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "c") {
        this.store.set_clipboard(this.store.get_selections());
      }
      if (e.ctrlKey && e.key.toLowerCase() === "v") {
        this.store.add(this.store.get_clipboard());
      }

      if (e.key.toLowerCase() === "delete") {
        this.store.remove();
      }
    },
  },
  computed: {
    availableItems() {
      return this.items;
    },
    storeFilter: {
      get(): string {
        return this.store.filter;
      },

      set(v: string) {
        const prev = this.filtered as EditorBase[];
        for (const p of prev) {
          delete p.showInEditor;
          delete p.showChildsInEditor;
          forEachParent(p as EditorBase, (parent) => {
            delete parent.showInEditor;
            delete p.showChildsInEditor;
          });
        }
        this.filtered = this.catalogue.findOptionsByName(v) as EditorBase[];
        for (const p of this.filtered) {
          p.showInEditor = true;
          p.showChildsInEditor = true;
          forEachParent(p as EditorBase, (parent) => {
            parent.showInEditor = true;
          });
        }
        this.store.set_filter(v);
      },
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.leftPanel {
  height: 100%;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}
.top {
  height: 100%;
  overflow-y: auto;
  position: relative;
}
.bottom {
  position: sticky;
  width: 100%;
  margin-top: auto;
  bottom: 0;
}
</style>

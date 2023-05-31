<template>
  <div class="leftPanel">
    <div class="top scrollable" @scroll="$emit('scrolltop', $event)" @keydown.capture="keydown">
      <CatalogueEntry :item="catalogue" grouped id="editor-entries" :showImported="showImported" />
    </div>
    <div class="bottom border-1px border-gray-400 border-solid">
      <input v-model="showImported" type="checkbox" id="showimport" /> <label for="showimport">Show Imported</label>
      <span class="absolute right-5px">
        <input v-model="ignoreProfilesRules" type="checkbox" id="ignoreProfilesRules" />
        <label for="ignoreProfilesRules">Ignore Profiles/Rules</label>
      </span>
      <input v-model="storeFilter" ref="editor-searchbox" type="search" placeholder="search... ctrl+f" class="w-full" />
    </div>
  </div>
</template>

<script lang="ts">
import { forEachParent } from "~/assets/shared/battlescribe/bs_editor";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import CatalogueEntry from "./components/CatalogueEntry.vue";

export default {
  emits: ["scrolltop"],
  setup() {
    return { store: useEditorStore() };
  },
  data() {
    return {
      showImported: false,
      ignoreProfilesRules: false,
    };
  },
  mounted() {
    addEventListener("keydown", this.keydown);
  },
  unmounted() {
    removeEventListener("keydown", this.keydown);
  },
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
  methods: {
    keydown(e: KeyboardEvent) {
      if (this.$route.name !== "catalogue") return;
      if (!e.target) return;
      const tagName = (e.target as HTMLSelectElement)?.tagName?.toLowerCase();
      const key = e.key.toLowerCase();
      if (e.ctrlKey && key === "f") {
        e.preventDefault();
        (this.$refs["editor-searchbox"] as HTMLInputElement).focus();
      }
      if (key === "escape") {
        (this.$refs["editor-searchbox"] as HTMLInputElement).blur();
      }
      if (tagName === "body") {
        if (e.ctrlKey && key === "z") {
          e.preventDefault();
          this.store.undo();
        }
        if (e.ctrlKey && key === "y") {
          e.preventDefault();
          this.store.redo();
        }
        if (e.ctrlKey && key === "x") {
          e.preventDefault();
          this.store.set_clipboard(this.store.get_selections());
          this.store.remove();
        }
        if (e.ctrlKey && key === "c") {
          e.preventDefault();
          this.store.set_clipboard(this.store.get_selections());
        }
        if (e.ctrlKey && key === "v") {
          e.preventDefault();
          this.store.add(this.store.get_clipboard());
        }
        if (e.ctrlKey && key === "d") {
          e.preventDefault();
          this.store.duplicate();
        }
        if (key === "delete") {
          e.preventDefault();
          this.store.remove();
        }
      }
    },
    async update(data: any) {
      const { filter, ignoreProfilesRules } = data;
      const prev = this.store.filtered as EditorBase[];
      for (const p of prev) {
        delete p.showInEditor;
        delete p.showChildsInEditor;
        delete p.highlight;
        forEachParent(p as EditorBase, (parent) => {
          delete parent.showInEditor;
          delete p.showChildsInEditor;
        });
      }
      this.store.set_filter(filter);
      if (filter.length > 0) {
        this.store.filtered = this.catalogue.findOptionsByText(filter) as EditorBase[];
        if (ignoreProfilesRules) {
          this.store.filtered = this.store.filtered.filter((o) => !o.isProfile() && !o.isRule() && !o.isInfoGroup());
        }
        for (const p of this.store.filtered) {
          p.showInEditor = true;
          p.showChildsInEditor = true;
          p.highlight = true;
          forEachParent(p as EditorBase, (parent) => {
            parent.showInEditor = true;
          });
        }
        await nextTick();
        for (const p of this.store.filtered) {
          if (!p.parent) continue;
          try {
            await this.store.open(p as EditorBase, true);
          } catch (e) {
            continue;
          }
        }
      } else {
        this.store.filtered = [];
      }
    },
  },
  computed: {
    filterData() {
      return {
        filter: this.store.filter,
        ignoreProfilesRules: this.ignoreProfilesRules,
      };
    },
    storeFilter: {
      get(): string {
        return this.store.filter;
      },
      async set(v: string) {
        this.store.filter = v.trim();
      },
    },
  },
  watch: {
    filterData(data) {
      this.update(data);
    },
  },
  components: { CatalogueEntry },
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
  position: relative;
}
.bottom {
  position: sticky;
  width: 100%;
  margin-top: auto;
  bottom: 0;
}
input:focus::placeholder {
  color: transparent;
}
</style>

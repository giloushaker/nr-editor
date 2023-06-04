<template>
  <div class="leftPanel">
    <div class="static sticky flex items-center h-28px">
      <!-- <span class="bold p-4px">&lt;</span> -->
      <!-- <span class="bold p-4px">&gt;</span> -->
      <img
        @click="uistate.collapse_deepest"
        class="align-middle absolute right-0 p-2px hover-darken cursor-pointer"
        title="Collapse Last Open Level"
        src="/assets/icons/collapse-all.svg"
      />
    </div>
    <div class="top rightborder scrollable" ref="scrollable" @scroll="onscroll" @keydown.capture="keydown">
      <CatalogueEntry class="mb-40px" :item="catalogue" grouped id="editor-entries" :showImported="showImported" />
    </div>
    <div class="bottom static">
      <span v-if="!catalogue.isGameSystem()">
        <input
          class="cursor-pointer"
          v-model="showImported"
          @change="showImportedChanged"
          type="checkbox"
          id="showimport"
        />
        <label class="unselectable cursor-pointer" for="showimport">Show Imported</label>
      </span>
      <span> &nbsp;</span>
      <span class="absolute right-5px">
        <input class="cursor-pointer" v-model="ignoreProfilesRules" type="checkbox" id="ignoreProfilesRules" />
        <label class="unselectable cursor-pointer" for="ignoreProfilesRules">Ignore Profiles/Rules</label>
      </span>
      <input v-model="filter" ref="editor-searchbox" type="search" placeholder="search... ctrl+f" class="w-full" />
    </div>
  </div>
</template>

<script lang="ts">
import { forEachParent } from "~/assets/shared/battlescribe/bs_editor";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import CatalogueEntry from "./components/CatalogueEntry.vue";
import { useEditorUIState } from "~/stores/editorUIState";

export const LeftPanelDefaults = {
  showImported: false,
  ignoreProfilesRules: false,
  filter: "",
  scroll: 0,
};

export default {
  emits: ["scrolltop"],
  setup() {
    return { store: useEditorStore(), uistate: useEditorUIState() };
  },
  data() {
    return {
      ...LeftPanelDefaults,
      ...this.defaults,
    };
  },
  mounted() {
    addEventListener("keydown", this.keydown);
    this.$nextTick(() => {
      const scrollable_el = this.$refs.scrollable as HTMLDivElement | undefined;
      if (scrollable_el) {
        scrollable_el.scrollTop = this.scroll;
      }
    });
  },
  unmounted() {
    removeEventListener("keydown", this.keydown);
  },
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    defaults: {
      type: Object as PropType<{ showImported?: boolean }>,
      default: {},
    },
  },
  methods: {
    onscroll(event: Event) {
      this.scroll = (event.target as HTMLDivElement).scrollTop;
    },
    async keydown(e: KeyboardEvent) {
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
        this.store.filter = "";
        this.update(this.filterData);
      }
      if (tagName === "body") {
        if (e.ctrlKey && key === "z") {
          e.preventDefault();
          await this.store.undo();
        }
        if (e.ctrlKey && key === "y") {
          e.preventDefault();
          await this.store.redo();
        }
        if (e.ctrlKey && key === "x") {
          e.preventDefault();
          await this.store.set_clipboard(this.store.get_selections());
          this.store.remove();
        }
        if (e.ctrlKey && key === "c") {
          e.preventDefault();
          await this.store.set_clipboard(this.store.get_selections());
        }
        if (e.ctrlKey && key === "v") {
          e.preventDefault();
          await this.store.add(await this.store.get_clipboard());
        }
        if (e.ctrlKey && key === "d") {
          e.preventDefault();
          await this.store.duplicate();
        }
        if (key === "delete") {
          e.preventDefault();
          await this.store.remove();
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
      if (filter.length > 1) {
        this.store.set_filter(filter);
        // let t1 = Date.now();
        this.store.filtered = this.catalogue.findOptionsByText(filter) as EditorBase[];
        if (ignoreProfilesRules) {
          this.store.filtered = this.store.filtered.filter((o) => !o.isProfile() && !o.isRule() && !o.isInfoGroup());
        }
        // let t2 = Date.now();
        for (const p of this.store.filtered) {
          p.showInEditor = true;
          p.showChildsInEditor = true;
          p.highlight = true;
          forEachParent(p as EditorBase, (parent) => {
            parent.showInEditor = true;
          });
        }
        // let t3 = Date.now();
        await nextTick();
        // let t4 = Date.now();

        console.log(this.store.filtered.length, this.store.filter);
        if (this.store.filtered.length < 300) {
          for (const p of this.store.filtered) {
            if (!p.parent) continue;
            try {
              await this.store.open(p as EditorBase, false);
            } catch (e) {
              continue;
            }
          }
        }
        // let t5 = Date.now();
        // this.$nextTick(() => {
        //   let t6 = Date.now();
        //   console.log("search", t2 - t1);
        //   console.log("set display status", t3 - t2);
        //   console.log("render1", t4 - t3);
        //   console.log("open", t5 - t4);
        //   console.log("render2", t6 - t5);
        // });
      } else {
        this.store.set_filter("");
        this.store.filtered = [];
      }
    },
    showImportedChanged() {
      this.catalogue.imports.map((o) => o.processForEditor());
    },
  },
  computed: {
    filterData() {
      return {
        filter: this.filter.trim(),
        ignoreProfilesRules: this.ignoreProfilesRules,
      };
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
  margin-top: auto;
  bottom: 0;
}
input:focus::placeholder {
  color: transparent;
}
.static {
  background-color: rgba(0, 0, 0, 0.1);
  border: 1px solid rgb(177, 177, 177);
}
.rightborder {
  border-right: 1px solid rgb(177, 177, 177);
}
</style>

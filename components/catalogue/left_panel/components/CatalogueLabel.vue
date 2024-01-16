<template>
  <div class="item unselectable" @contextmenu.stop="contextmenu.show">
    <EditorCollapsibleBox nobox :group="[]" :collapsible="true" :class="[`depth-${depth}`, `label-${label}`]" vshow>
      <template #title><img src="/assets/bsicons/profileType.png" />
        <span class="gray"> {{ label }}</span>
      </template>
      <template #content>
        <slot />
      </template>
    </EditorCollapsibleBox>
    <ContextMenu v-if="contextmenuopen" v-model="contextmenuopen" ref="contextmenu">
      <template #default="{ payload }">
        <template v-if="item">
          <div v-if="item" @click="store.goto(item)">
            Goto -{{ item.getName() }}
          </div>
          <Separator />
          <div
            @click="store.create_child('profiles', catalogue as EditorBase, { typeName: item?.getName(), typeId: item?.getId() })">
            <img class="pr-4px" src="assets/bsicons/profile.png" />
            Profile <span class="gray">&nbsp;({{ item?.getName() }})</span>
          </div>
        </template>
      </template>
    </ContextMenu>
  </div>
</template>

<script lang="ts">
import { useEditorStore } from "~/stores/editorStore";
import ContextMenu from "~/components/dialog/ContextMenu.vue";
import EditorCollapsibleBox from "~/components/catalogue/left_panel/components/EditorCollapsibleBox.vue";
import { useEditorUIState } from "~/stores/editorUIState";
import { useSettingsStore } from "~/stores/settingsState";
import type { EntryPathEntry } from "~/assets/shared/battlescribe/bs_editor";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  name: "CatalogueEntry",
  components: {
    ContextMenu,
    EditorCollapsibleBox,
  },
  setup() {
    return { store: useEditorStore(), state: useEditorUIState(), settings: useSettingsStore() };
  },
  props: {
    depth: {
      type: Number,
      default: 0,
    },
    label: {
      type: String,
      required: true
    },
    catalogue: {
      type: Object,
      required: true
    },
    path: {
      type: Array
    },
    item: {
      type: Object as PropType<EditorBase>
    }
  },
  data() {
    return {
      groups: {} as Record<string, any>,
      contextmenuopen: false,
      open: false,
      open_categories: undefined as Set<string> | undefined,
      name: "",
    };
  },
  mounted() {
    if (this.catalogue) {
      this.catalogue.processForEditor();
      const fullPath = [...(this.path || []), {
        key: `label-${this.label}`,
        index: 0,
      }] as EntryPathEntry[];
      this.open = this.state.get(this.catalogue.id, fullPath);
    }
  },
  methods: {
    menu(ref: string) {
      return {
        show: (event: MouseEvent, e: any) => {
          this.contextmenuopen = true;
          this.$nextTick(() => {
            (this.$refs[ref] as any)?.show(event, e);
          });
        },
        close: (event: MouseEvent, e: any) => {
          (this.$refs[ref] as any)?.close(event, e);
          this.contextmenuopen = false;
        },
      };
    },

  },

  computed: {
    contextmenu() {
      return this.menu("contextmenu");
    },
    nestedcontextmenu() {
      return this.menu("nestedcontextmenu");
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.imported {
  color: rgb(128, 145, 183);
  // font-style: italic;
}

.filtered {
  background-color: rgba(10, 80, 255, 0.15);
}

.typeIcon {
  max-width: 18px;
}

.typeIcon-wrapper {
  display: inline-block;
  min-width: 20px;
  min-height: 1px;
}

.head {
  margin-left: -20px;
}

.text-orange {
  color: rgb(153 31 31);
}
</style>

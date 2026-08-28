<template>
  <div class="item unselectable" @click.middle.stop="debug" @contextmenu.stop="contextmenu.show">
    <EditorCollapsibleBox
      nobox
      :group="[]"
      :depth="depth"
      :collapsible="true"
      :class="[`depth-${depth}`, `label-${label}`]"
      vshow
    >
      <template #title
        ><img src="/assets/bsicons/profileType.png" />
        <span class="gray"> {{ label }}</span>
      </template>
      <template #content>
        <slot />
      </template>
    </EditorCollapsibleBox>
    <ContextMenu v-if="contextmenuopen" v-model="contextmenuopen" ref="contextmenu">
      <ContextMenuItems :groups="buildMenu()" />
    </ContextMenu>
  </div>
</template>

<script lang="ts">
import { useEditorStore } from "~/stores/editorStore";
import ContextMenu from "~/components/dialog/ContextMenu.vue";
import ContextMenuItems from "~/components/dialog/ContextMenuItems.vue";
import type { MenuItem } from "~/components/dialog/menu";
import EditorCollapsibleBox from "~/components/catalogue/left_panel/components/EditorCollapsibleBox.vue";
import { useEditorUIState } from "~/stores/editorUIState";
import { useSettingsStore } from "~/stores/settingsState";
import { EntryPathEntry } from "~/assets/editor/bs_editor";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  // Was "CatalogueEntry", which is the name of a different component in this same folder:
  // anything resolving a component by name from here reached the wrong one.
  name: "CatalogueLabel",
  components: {
    ContextMenu,
    ContextMenuItems,
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
      required: true,
    },
    catalogue: {
      type: Object,
      required: true,
    },
    path: {
      type: Array,
    },
    typeItem: {
      type: Object as PropType<EditorBase>,
    },
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
    should_be_open() {
      const fullPath = [
        ...(this.path || []),
        {
          key: `label-${this.label}`,
          index: 0,
        },
      ] as EntryPathEntry[];
      this.open = this.state.get(this.catalogue.id, fullPath);
    },
    /** See CatalogueEntry.buildMenu: the menu is data, and separators fall out of the groups. */
    buildMenu(): MenuItem[][] {
      const type = this.typeItem;
      // Untyped profiles get a label with no type behind it; an item with no run() is inert.
      if (!type) return [[{ label: "Nothing" }]];
      return [
        [{ label: `Goto (${type.getName()})`, run: () => this.store.goto(type) }],
        [
          {
            label: "Profile",
            icon: "assets/bsicons/profile.png",
            note: `(${type.getName()})`,
            run: () =>
              this.store.create_child("sharedProfiles", this.catalogue as EditorBase, {
                typeName: type.getName(),
                typeId: type.getId(),
              }),
          },
        ],
      ];
    },
    debug() {
      console.log(this.typeItem?.name, this.typeItem?.editorTypeName, toRaw(this.typeItem));
      (globalThis as any).$debugOption = this.typeItem;
      (globalThis as any).$debugElement = this;
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
  vertical-align: middle;
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

<template>
  <div
    :class="{ box, nobox, nocollapse, collapsed, opened }"
    class="collapsible-box"
    @contextmenu="do_rightcllick_select"
  >
    <h3
      ref="title"
      v-if="!notitle"
      class="title"
      :class="{
        selected,
        arrowTitle: collapsible,
        normalTitle: !collapsible,
        collapsed: collapsible && collapsed,
        alt: alt && altclickable,
      }"
      @click.stop="do_select"
      @click.ctrl.stop="$emit('ctrlclick')"
      @click.alt.stop="$emit('altclick')"
      @dblclick="collapseSwitch($event.shiftKey)"
      @paste="paste"
      @copy="paste"
      @cut="paste"
      :style="{
        'padding-left': indent,
        'z-index': `${100 - depth}`,
        ...(settings.stickyScroll ? { top: `${depth * 20}px`, left: `0px`, position: 'sticky' } : {}),
      }"
    >
      <span class="title-before" :style="{ width: indent }" v-if="depth > 0" />
      <div class="arrow-wrap" @click.stop="collapseSwitch($event.shiftKey)">
        <img :class="{ hide }" :src="dropdownSrc" class="arrow icon" />
      </div>

      <slot name="title" />
    </h3>
    <div v-if="initiated" v-show="!collapsed || !collapsible" class="content">
      <slot name="content" />
    </div>
  </div>
</template>

<script lang="ts">
import { get_ctx, get_base_from_vue_el, useEditorStore } from "~/stores/editorStore";
import { useSettingsStore } from "~/stores/settingsState";

export default {
  name: "EditorCollapsibleBox",
  props: {
    payload: {},

    collapsible: {
      type: Boolean,
      default: true,
    },

    nobox: {
      type: Boolean,
      default: false,
    },
    defcollapsed: {
      type: Boolean,
      default: true,
    },

    notitle: {
      type: Boolean,
      default: false,
    },

    title: {
      type: String,
      required: false,
      default: "titreCategory",
    },

    titleCollapse: {
      type: Boolean,
      default: true,
    },
    modelValue: {
      default: true,
    },
    altclickable: {
      default: false,
    },
    vshow: {
      default: false,
      type: Boolean,
    },
    depth: {
      default: 0,
      type: Number,
    },
  },

  data() {
    return {
      collapsed: true,
      initiated: this.vshow,
      selected: false,
      alt: false,
      sticky: false,
    };
  },

  created() {
    if (this.defcollapsed == false) {
      this.collapseSwitch();
    }
  },
  setup() {
    return { store: useEditorStore(), settings: useSettingsStore() };
  },
  mounted() {
    addEventListener("keydown", this.handleKeyDown);
    addEventListener("keyup", this.handleKeyUp);
    this.$el.vnode = this;
    this.init(this.payload);
  },

  updated() {
    this.$el.vnode = this;
  },
  unmounted() {
    // console.log("unmounted", this.depth);
    removeEventListener("keydown", this.handleKeyDown);
    removeEventListener("keyup", this.handleKeyUp);
  },
  watch: {
    payload(data) {
      this.init(data);
    },
    collapsed(newVal) {
      if (newVal !== this.modelValue) {
        this.$emit("update:modelValue", newVal);
      }
    },
    modelValue(modelValue) {
      if (modelValue != this.collapsed) {
        this.collapsed = modelValue;
      }
    },
  },
  computed: {
    dropdownSrc() {
      let n = 2;
      let images = [`assets/icons/right${n}.png`, `assets/icons/down${n}.png`];
      let index = this.collapsed ? 0 : 1;
      return images[index];
    },
    hide() {
      return !this.collapsible;
    },
    nocollapse() {
      return !this.collapsible;
    },
    box() {
      return !this.nobox;
    },
    opened() {
      return this.collapsible && !this.collapsed;
    },
    indent() {
      return `${this.depth * 20}px`;
    },
  },

  methods: {
    cut() {
      console.log("cut");
    },
    copy() {
      console.log("copy");
    },
    paste() {
      console.log("paste");
    },
    init(data: any) {
      if (data?.select !== undefined) {
        if (data.select) {
          const parentBox = this.$parent?.$parent as { open?: () => unknown };
          parentBox.open && parentBox.open();
          this.store.do_select(null, this as any);
          this.store.scrollto(get_base_from_vue_el(this));
        }
        delete data?.select;
      }
    },
    select() {
      this.selected = true;
      this.store.select(this, () => this.unselect(), this.payload);
    },
    unselect() {
      this.selected = false;
    },
    open() {
      this.initiated = true;

      if (this.collapsed) {
        this.collapsed = false;
        this.$emit("open");
      }
    },
    async open_recursive() {
      this.open();
      await this.$nextTick();
      const el = this.$el as HTMLDivElement;
      if (el) {
        for (const nested of el.getElementsByClassName("collapsible-box")) {
          await get_ctx(nested)?.open_recursive();
        }
      }
    },
    close() {
      this.initiated = true;

      if (!this.collapsed) {
        this.collapsed = true;
        this.$emit("close");
      }
    },
    async close_recursive() {
      const el = this.$el as HTMLDivElement;
      if (el) {
        for (const nested of el.getElementsByClassName("collapsible-box")) {
          get_ctx(nested)?.close_recursive();
        }
      }
      await this.$nextTick();
      this.close();
    },
    do_select(e: MouseEvent) {
      this.store.do_select(e, this as any);
      this.$el.focus();
    },
    do_rightcllick_select(e: MouseEvent) {
      this.store.do_rightclick_select(e, this as any);
    },
    async collapseSwitch(deep?: boolean) {
      this.collapsed = !this.collapsed;
      this.initiated = true;
      if (this.collapsed == false) {
        deep ? await this.open_recursive() : this.open();
      } else {
        deep ? await this.close_recursive() : this.close();
      }
    },
    handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Alt") {
        this.alt = true;
        event.preventDefault();
      }
    },
    handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Alt") {
        this.alt = false;
        event.preventDefault();
      }
    },
  },
};
</script>
<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.arrowTitle {
  cursor: pointer;
  position: relative;

  img.arrow {
    margin-left: 4px;
    margin-right: 4px;
  }
}

.title {
  white-space: nowrap;
  min-height: 23px;
  vertical-align: middle;
  display: flex;
  align-items: center;
  position: relative;
  background-color: rgb(var(--bg-r), var(--bg-g), var(--bg-b));
}
.title-before {
  content: "";
  position: absolute;
  top: 0;
  left: 11px;
  bottom: 0;
  background-image: linear-gradient(to left, transparent 95%, #88888888 5%);
  background-size: 20px;
}
h3 {
  font-size: 16px;
  font-weight: normal;
}

.arrow {
  height: 12px;
}

.arrow-wrap {
  vertical-align: middle;

  display: inline-block;
  min-height: 1px;
  min-width: 22px;
  margin-left: 2px;
}

// indent

.selected::before {
  content: "";
  position: absolute;
  top: 0;
  left: -9999px;
  /* extend far to the left */
  right: 0;
  bottom: 0;
  background: rgba(125, 125, 125, 0.3);
  z-index: -1;
}

.title:hover::before {
  background-color: var(--hover-darken-color, rgba(0, 0, 0, 0.15));
  content: "";
  position: absolute;
  top: 0;
  left: -9999px;
  right: 0;
  bottom: 0;
  z-index: -1;
}

.hide {
  display: none;
}

.alt:hover {
  text-decoration: underline;
  cursor: pointer;
}
</style>

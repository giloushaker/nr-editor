<template>
  <div
    :class="{ box, nobox, nocollapse, collapsed, opened }"
    class="collapsible-box"
    @contextmenu="do_rightcllick_select"
  >
    <h3
      v-if="!notitle"
      class="title hover-darken"
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
    >
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
import { PropType } from "vue";
import { get_ctx, get_base_from_vue_el, useEditorStore } from "~/stores/editorStore";

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
    group: {
      type: Array as PropType<any[]>,
      required: true,
    },
    modelValue: {
      default: true,
    },
    altclickable: {
      default: false,
    },
  },

  data() {
    return {
      collapsed: true,
      initiated: false,
      selected: false,
      alt: false,
    };
  },

  created() {
    if (this.defcollapsed == false) {
      this.collapseSwitch();
    }
  },
  setup() {
    return { store: useEditorStore() };
  },
  mounted() {
    addEventListener("keydown", this.handleKeyDown);
    addEventListener("keyup", this.handleKeyUp);
    this.$el.vnode = this;
    this.group?.push(this);
    this.init(this.payload);
  },

  updated() {
    this.$el.vnode = this;
  },
  unmounted() {
    removeEventListener("keydown", this.handleKeyDown);
    removeEventListener("keyup", this.handleKeyUp);
    if (this.group && Array.isArray(this.group)) {
      const idx = this.group.indexOf(this as any);
      if (idx !== -1) {
        this.group?.splice(idx, 1);
      }
    }
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
      let images = [`./assets/icons/right${n}.png`, `./assets/icons/down${n}.png`];
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
          this.store.do_select(null, this as any, this.group);
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
      this.store.do_select(e, this as any, this.group);
      this.$el.focus();
    },
    do_rightcllick_select(e: MouseEvent) {
      this.store.do_rightclick_select(e, this as any, this.group);
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
  // padding-top: 2px;
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
.nobox > .content {
  padding-left: 20px;
}

.selected {
  background-color: rgba(125, 125, 125, 0.3);
}

.hide {
  display: none;
}

.alt:hover {
  text-decoration: underline;
  cursor: pointer;
}
</style>

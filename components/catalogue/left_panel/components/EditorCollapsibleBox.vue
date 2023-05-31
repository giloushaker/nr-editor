<template>
  <div
    :class="{ box, nobox, nocollapse, collapsed, opened }"
    class="collapsible-box"
    @contextmenu="do_rightcllick_select"
  >
    <h3
      v-if="!notitle"
      class="title"
      :class="{ selected, arrowTitle: collapsible, normalTitle: !collapsible, collapsed: collapsible && collapsed }"
      @click.stop="do_select"
      @dblclick="collapseSwitch"
    >
      <div class="arrow-wrap" @click.stop="collapseSwitch">
        <img :class="{ hide }" :src="dropdownSrc" class="arrow" />
      </div>

      <slot name="title" />
    </h3>
    <div v-if="initiated" v-show="!collapsed || !collapsible" class="content">
      <slot name="content" />
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { useEditorStore } from "~/stores/editorStore";

export default {
  props: {
    payload: {
      type: Object,
    },

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
  },

  data() {
    return {
      collapsed: true,
      initiated: false,
      selected: false,
    };
  },

  created() {
    if (!this.collapsible || this.defcollapsed == false) {
      this.collapseSwitch();
    }
  },
  setup() {
    return { store: useEditorStore() };
  },
  mounted() {
    this.$el.vnode = this;
    this.group?.push(this);
    this.init(this.payload);
  },
  updated() {
    this.$el.vnode = this;
  },
  destroyed() {
    if (this.group && Array.isArray(this.group)) {
      const idx = this.group.findIndex(this as any);
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
    init(data: any) {
      if (data?.select !== undefined) {
        if (data.select) {
          this.store.do_select(null, this as any, this.group);
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
      if (this.collapsed) {
        this.collapseSwitch();
      }
    },
    close() {
      if (!this.collapsed) {
        this.collapseSwitch();
      }
    },
    do_select(e: MouseEvent) {
      this.store.do_select(e, this as any, this.group);
    },
    do_rightcllick_select(e: MouseEvent) {
      this.store.do_rightclick_select(e, this as any, this.group);
    },
    collapseSwitch() {
      this.collapsed = !this.collapsed;
      this.initiated = true;
      if (this.collapsed == false) {
        this.$emit("open");
      } else {
        this.$emit("close");
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
  background-color: rgba(0, 0, 0, 0.1);
}

.hide {
  display: none;
}
</style>

<template>
  <div
    :class="{
      nobox,
      noboxindent,
      box: !nobox && !noboxindent,
      nocollapse: !collapsible,
      verticalbox: collapsed && vertical,
    }"
    class="EditorCollapsibleBox"
    @contextmenu="do_rightcllick_select"
  >
    <div class="title" :class="{ selected }" @click.stop="do_select" @dblclick="collapseSwitch">
      <h3
        v-if="!notitle"
        :class="[
          {
            arrowTitle: collapsible,
            normalTitle: !collapsible,
            collapsed: collapsible && collapsed,
          },
        ]"
      >
        <div class="arrow-wrap" @click.stop="collapseSwitch">
          <img :class="{ hide: !collapsible }" :src="dropdownSrc" class="arrow" />
        </div>

        <slot name="title" class="title" />
      </h3>
    </div>
    <div v-if="initiated && !empty" v-show="!collapsed || !collapsible" class="boxContent">
      <slot name="content" />
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";
import { useEditorStore } from "~/stores/editorState";

export default {
  props: {
    payload: {
      type: Object,
    },
    empty: {
      type: Boolean,
      default: false,
    },

    collapsible: {
      type: Boolean,
      default: true,
    },

    nobox: {
      type: Boolean,
      default: false,
    },

    noboxindent: {
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

    vertical: {
      type: Boolean,
      default: false,
    },

    titleCollapse: {
      type: Boolean,
      default: true,
    },
    group: {
      type: Array as PropType<any[]>,
      required: true,
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
    this.group?.push(this);
    this.init(this.payload);
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
  },
  computed: {
    dropdownSrc() {
      let n = 2;
      let images = [`assets/icons/right${n}.png`, `assets/icons/down${n}.png`];
      let index = this.collapsed ? 0 : 1;
      if (this.vertical) {
        index = 1 - index;
      }
      return images[index];
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

    titleSwitch() {
      if (this.titleCollapse) {
        this.collapseSwitch();
      } else {
        this.$emit("titleClick");
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
  width: 22px;
  margin-left: 2px;
}
// indent
.nobox > .boxContent {
  padding-left: 15px;
}

.collapsed {
  filter: brightness(95%);
}

.selected {
  background-color: rgba(0, 0, 0, 0.1);
}

.hide {
  display: none;
}
</style>

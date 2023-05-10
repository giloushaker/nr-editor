<template>
  <div
    :class="{
      box: !nobox && !noboxindent,
      nobox: nobox,
      nocollapse: !collapsible,
      noboxindent: noboxindent,
      verticalbox: collapsed && vertical,
    }"
    class="EditorCollapsibleBox"
  >
    <h3
      v-if="!notitle"
      :class="[
        {
          selected: selected,
          arrowTitle: collapsible,
          normalTitle: !collapsible,
          collapsed: collapsible && collapsed,
        },
      ]"
      @click="titleSwitch"
    >
      <img
        v-if="collapsible"
        :src="dropdownSrc"
        class="icon arrow"
        @click.stop="collapseSwitch"
      />
      <slot name="title" class="title" />
    </h3>
    <div
      v-if="initiated && !empty"
      v-show="!collapsed || !collapsible"
      class="boxContent"
    >
      <slot name="content" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    empty: {
      type: Boolean,
      default: false,
    },
    selected: Boolean,
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
  },

  data() {
    return {
      collapsed: true,
      initiated: false,
    };
  },

  created() {
    if (!this.collapsible || this.defcollapsed == false) {
      this.collapseSwitch();
    }
  },

  computed: {
    dropdownSrc() {
      let n = 2;
      let images = [
        `/assets/icons/right${n}.png`,
        `/assets/icons/down${n}.png`,
      ];
      let index = this.collapsed ? 0 : 1;
      if (this.vertical) {
        index = 1 - index;
      }
      return images[index];
    },
  },

  methods: {
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
    vertical-align: middle;
    margin-right: 7px;
  }
}

.normalTitle {
  position: relative;
  padding-top: 5px;
  padding-left: 8px;
}

h3 {
  font-size: 16px;
  font-weight: normal;
}

.EditorCollapsibleBox.box {
  padding: 0px !important;
}

.boxContent {
  padding: 5px;
  padding-top: 0;
}

.noboxindent {
  .boxContent {
    border-left: 1px #ccc solid;
  }
}

.nobox > .boxContent {
  padding-left: 5px;
}

.collapsed {
  filter: brightness(95%);
}

.verticalbox {
  width: 25px;

  h3 {
    text-orientation: upright;
    writing-mode: vertical-rl;
  }
}

.selected {
  background-color: rgba(0, 0, 0, 0.1);
}

.arrow {
  height: 12px;
}

.nocollapse {
  padding-left: 14px;
}
</style>

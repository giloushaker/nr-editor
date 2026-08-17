<template>
  <div
    :class="{
      box: !nobox && !noboxindent,
      nobox: nobox,
      nocollapse: !collapsible,
      noboxindent: noboxindent,
      verticalbox: collapsed && vertical,
    }"
    class="collapsibleBox"
    :id="id"
  >
    <h3
      v-if="!notitle"
      :class="[
        {
          arrowTitle: collapsible,
          normalTitle: !collapsible,
          collapsed: collapsible && collapsed,
          titleClickCollapsible: collapsible && !collapsed && titleCollapse,
          titleClickEffect: collapsed || collapsible,
        },
        title,
      ]"
      @click="titleSwitch"
    >
      <img
        v-if="collapsible && icon && iconLocation === 'left'"
        :src="dropdownSrc"
        class="icon arrow"
        :class="{ right, left, down }"
        @click.stop="collapseSwitch"
      />
      <slot name="title" class="title" />
      <img
        v-if="collapsible && icon && iconLocation === 'right'"
        :src="dropdownSrc"
        class="icon arrow arrowRight"
        :class="{ right, left, down }"
        @click.stop="collapseSwitch"
      />
    </h3>
    <Transition
      name="slide"
      @before-enter="beforeEnter"
      @enter="enter"
      @after-enter="afterEnter"
      @before-leave="beforeLeave"
      @leave="leave"
    >
      <div v-if="initiated && (!collapsed || !collapsible)" class="boxContent" ref="boxContent">
        <slot name="content" />
      </div>
    </Transition>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";

export default {
  props: {
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
    id: {
      type: String,
      required: false,
    },
    icon: {
      type: Boolean,
      default: true,
    },
    iconLocation: {
      type: String as PropType<"left" | "right">,
      default: "left",
    },
    locked: {
      type: Boolean,
      default: false,
    },
  },
  mounted() {
    if (this.id && this.$route.hash) {
      if (this.$route.hash.substring(1) === this.id && this.collapsed) {
        this.$nextTick(() => {
          this.collapseSwitch();
          (this.$el as HTMLDivElement)?.scrollIntoView({ block: "center" });
        });
      }
    }
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
      const n = this.$optionStore?.options?.appearence?.dropdownStyle || 2;
      return `assets/icons/right${n}.png`;
    },
    left() {
      if (this.vertical) return false;
      if (this.iconLocation === "right") return this.collapsed;
      return false;
    },
    right() {
      if (this.vertical) return this.collapsed;
      if (this.iconLocation === "left") return this.collapsed;
      return false;
    },
    down() {
      return !this.collapsed;
    },
  },

  methods: {
    collapseSwitch() {
      if (this.locked) return;
      this.collapsed = !this.collapsed;
      this.initiated = true;
      if (this.collapsed == false) {
        this.$emit("open");
        this.$emit("change");
      } else {
        this.$emit("close");
        this.$emit("change");
      }
    },

    titleSwitch() {
      if (this.titleCollapse) {
        this.collapseSwitch();
      } else {
        this.$emit("titleClick");
      }
    },

    // Transition hooks for smooth slide
    beforeEnter(el: HTMLElement) {
      el.style.height = "0";
      el.style.overflow = "hidden";
    },

    enter(el: HTMLElement, done: () => void) {
      el.style.height = "auto";
      const endHeight = getComputedStyle(el).height;
      el.style.height = "0";

      // Force reflow
      el.offsetHeight;

      el.style.transition = "height 0.12s ease-out";
      el.style.height = endHeight;

      setTimeout(() => {
        el.style.height = "auto";
        done();
      }, 200);
    },

    afterEnter(el: HTMLElement) {
      el.style.height = "";
      el.style.transition = "";
      el.style.overflow = "";
    },

    beforeLeave(el: HTMLElement) {
      el.style.height = getComputedStyle(el).height;
      el.style.overflow = "hidden";

      // Force reflow
      el.offsetHeight;
    },

    leave(el: HTMLElement, done: () => void) {
      el.style.transition = "height 0.12s ease-out";
      el.style.height = "0";

      setTimeout(done, 200);
    },
  },

  watch: {
    collapsible() {
      this.initiated = true;
    },
  },
};
</script>
<style scoped lang="scss">
@use "@/shared_components/css/vars.scss" as *;

.arrowTitle :deep(label) {
  cursor: pointer !important;
}

.arrowTitle.titleClickEffect {
  cursor: pointer !important;
}

.arrowTitle {
  position: relative;
  padding: 5px;

  img.arrow {
    vertical-align: bottom;
    margin-right: 5px;
  }
  img.arrow.left {
    transform: rotate(180deg);
  }
  img.arrow.down {
    transform: rotate(90deg);
  }
  img.arrow.up {
    transform: rotate(-90deg);
  }
}

.arrowRight {
  margin-left: auto;
}

.normalTitle {
  position: relative;
  padding-top: 5px;
  padding-left: 5px;
  font-size: $fontHeaderSize !important;
  font-weight: bold;
}

.collapsibleBox.box {
  padding: 0px !important;
}

.boxContent {
  padding: 5px;
}

.nobox > .boxContent {
  padding: 0px;
}

.collapsed {
  filter: brightness(95%);
}

.titleClickCollapsible:hover {
  filter: brightness(95%) !important;
}

.arrowTitle.collapsed:hover {
  filter: brightness(105%) !important;
}

.verticalbox {
  width: 25px;

  h3 {
    text-orientation: mixed;
    writing-mode: vertical-rl;
    padding-left: 0px !important;
    padding-right: 0px !important;
  }

  img {
    margin-bottom: 5px;
  }
}

html.mobile {
  .arrow {
    transition: transform 0.2s ease-out;
  }
}
</style>

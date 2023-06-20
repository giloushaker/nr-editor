<template>
  <div
    class="mainView splitMainView"
    :class="{
      splitMainView: split,
      doubleSplitView: double,
      tripleSplitView: triple,
    }"
    :style="height > 0 ? { height: `${height}px` } : {}"
  >
    <div class="left" ref="left" :style="{ width: leftw > 0 ? `${leftw}px` : leftWidth }">
      <slot name="left"></slot>
    </div>
    <div v-if="draggable" class="between unselectable" @mousedown="drag_left_handle" />

    <template v-if="triple">
      <div
        ref="middle"
        class="middle scrollable"
        :class="{ hidden: !split && showRight, hideOnSmallScreen: showRight }"
      >
        <slot name="middle"></slot>
      </div>
      <div v-if="draggable" class="between unselectable" @mousedown="drag_right_handle" />
    </template>
    <div
      v-if="showRight"
      ref="right"
      class="right grow"
      :style="{
        width: rightw > 0 ? `calc(100vw - ${rightw}px)` : rightWidth,
      }"
      :class="{
        hidden: !split && showRight == false,
        hideOnSmallScreen: showRight == false,
      }"
    >
      <slot name="right"></slot>
    </div>
  </div>
</template>

<script lang="ts">
import { useUIState } from "~/stores/uiState";

export default {
  props: {
    split: {},
    double: {},
    triple: {},
    showRight: {},
    draggable: {
      type: Boolean,
      default: false,
    },
    leftWidth: {
      type: String,
      default: "auto",
    },
    rightWidth: {
      type: String,
      default: "auto",
    },
    id: {
      type: String,
    },
  },
  data() {
    return { _leftWidth: 0, _rightWidth: 0, dragging: false, height: 0 };
  },
  setup() {
    return { store: useUIState() };
  },
  mounted() {
    if (this.draggable) {
      if (this.id) {
        const left = this.store.get(this.id, "left");
        if (left) this._leftWidth = left;
      }
      if (!this._leftWidth && this.$refs.left) {
        const element = this.$refs.left;
        const width = (element as HTMLDivElement).offsetWidth;
        this._leftWidth = width;
      }
      if (this.id) {
        const right = this.store.get(this.id, "right");
        if (right) this._rightWidth = right;
      }
      if (!this._rightWidth && this.$refs.right) {
        const element = this.$refs.right;
        const width = (element as HTMLDivElement).offsetWidth;
        this._rightWidth = width;
      }
    }
    addEventListener("resize", this.update);
    this.$nextTick(this.update);
  },

  unmounted() {
    removeEventListener("resize", this.update);
  },
  updated() {
    this.update();
  },
  computed: {
    left() {
      return this.$el?.offsetLeft || 0;
    },
    leftw() {
      return this._leftWidth - this.left;
    },
    right() {
      return this.$el?.offsetRight || 0;
    },
    rightw() {
      return this._rightWidth - this.right;
    },
    hasMiddle() {
      return !!this.$slots.middle;
    },
    totalWidth() {
      return this.$el.clientWidth;
    },
  },
  methods: {
    update() {
      const pos = (this.$el as HTMLDivElement)?.offsetTop || 0;
      this.height = innerHeight - pos;
    },
    clamp(val: number) {
      if (val < 100) return 100;
      if (val > this.totalWidth - 100) return this.totalWidth - 100;
      return val;
    },
    async drag_left_handle(e: MouseEvent) {
      this.dragging = true;
      const b = this._leftWidth;
      const x = e.clientX;
      const onmousemove = (m: MouseEvent) => {
        this._leftWidth = this.clamp(b + (m.clientX - x));
      };
      addEventListener("mousemove", onmousemove);
      const mouseupoptions = {
        once: true,
        capture: true,
      };
      addEventListener(
        "mouseup",
        () => {
          removeEventListener("mousemove", onmousemove);
          this.$nextTick(() => {
            this._leftWidth = (this.$refs.left as HTMLDivElement).clientWidth;
            this.dragging = false;
            if (this.id) this.store.set(this.id, "left", this._leftWidth);
          });
        },
        mouseupoptions
      );
    },
    async drag_right_handle(e: MouseEvent) {
      this.dragging = true;
      const b = this._leftWidth;
      const x = e.clientX;
      const onmousemove = (m: MouseEvent) => {
        this._leftWidth = this.clamp(b + (m.clientX - x));
      };
      addEventListener("mousemove", onmousemove);
      const mouseupoptions = {
        once: true,
        capture: true,
      };
      addEventListener(
        "mouseup",
        () => {
          this.$nextTick(() => {
            this._rightWidth = (this.$refs.right as HTMLDivElement).clientWidth;
            this.dragging = false;
            if (this.id) this.store.set(this.id, "right", this._rightWidth);
          });
        },
        mouseupoptions
      );
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.mainView {
  display: flex;
  width: 100%;
  height: 100%;
  // position: fixed;
}
.left,
.middle,
.right {
  height: 100%;
}

.right {
  flex: 1;
}

.between {
  background-color: rgba(0, 0, 100, 0.08);
  height: 100%;
  position: relative;
  cursor: ew-resize;
  width: 10px;
  z-index: 1;
}
</style>

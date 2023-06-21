<template>
  <div class="splitView" :style="height > 0 ? { height: `${height}px` } : {}">
    <div v-if="showLeft" class="left" ref="left" :style="{ width: leftw > 0 ? `${leftw}px` : leftWidth }">
      <slot name="left"></slot>
    </div>

    <div v-if="left_draggable" class="between unselectable" @mousedown="drag_left_handle" />

    <template v-if="showMiddle">
      <div ref="middle" class="middle grow">
        <slot name="middle"></slot>
      </div>
    </template>
    <div v-if="right_draggable" class="between unselectable" @mousedown="drag_right_handle" />
    <span
      v-if="showRight"
      ref="right"
      class="right"
      :style="{
        width: `${rightw}px`,
      }"
    >
      <slot name="right"></slot>
    </span>
  </div>
</template>

<script lang="ts">
import { useUIState } from "~/stores/uiState";
function getOffset(el: { getBoundingClientRect: () => any }) {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
  };
}
export default {
  props: {
    showLeft: {
      type: Boolean,
      default: true,
    },
    showMiddle: {
      type: Boolean,
      default: false,
    },
    showRight: {
      type: Boolean,
      default: false,
    },
    draggable: {
      type: Boolean,
      default: false,
    },
    leftWidth: {
      type: [String, Number],
      default: "auto",
    },
    rightWidth: {
      type: [String, Number],
      default: "auto",
    },
    clamp: {
      type: Number,
      default: 250,
    },
    id: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      _leftWidth: typeof this.leftWidth === "number" ? this.leftWidth : 0,
      _rightWidth: typeof this.rightWidth === "number" ? this.rightWidth : 0,
      dragging: false,
      height: 0,
      staticLeft: false,
      staticRight: false,
    };
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
      if (!this._leftWidth && this.$refs.left && (this.$refs.left as HTMLDivElement)?.offsetWidth) {
        this._leftWidth = (this.$refs.left as HTMLDivElement).offsetWidth;
      }
      if (this._leftWidth < this.clamp) {
        this._leftWidth = this.do_clamp(typeof this.leftWidth === "number" ? this.leftWidth : 0);
      }
      if (this.id) {
        const right = this.store.get(this.id, "right");
        if (right) this._rightWidth = right;
      }
      if (!this._rightWidth && (this.$refs.right as HTMLDivElement)?.offsetWidth) {
        this._rightWidth = (this.$refs.right as HTMLDivElement).offsetWidth;
      }
      if (this._rightWidth < this.clamp) {
        this._rightWidth = this.do_clamp(typeof this.rightWidth === "number" ? this.rightWidth : 0);
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
    left_draggable() {
      if (this.staticLeft) return false;
      return this.draggable && this.showLeft && (this.showMiddle || this.showRight);
    },
    right_draggable() {
      return this.draggable && this.showMiddle && this.showRight;
    },
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
  watch: {
    leftWidth(newVal: number | string) {
      if (typeof newVal === "string") return;
      if (!newVal) {
        this._leftWidth = this.store.get(this.id, "left") || 100;
        this.staticLeft = false;
      }
      if (newVal) {
        this._leftWidth = newVal;
        this.staticLeft = true;
      }
    },
  },
  methods: {
    update() {
      const pos = getOffset(this.$el)?.top;
      this.height = innerHeight - pos;
    },
    do_clamp(val: number) {
      if (val < this.clamp) return this.clamp;
      if (val > this.totalWidth - this.clamp) return this.totalWidth - this.clamp;
      return val;
    },
    async drag_left_handle(e: MouseEvent) {
      this.dragging = true;
      const b = this._leftWidth;
      const x = e.clientX;
      const onmousemove = (m: MouseEvent) => {
        const diff = m.clientX - x;
        this._leftWidth = this.do_clamp(b + diff);
      };
      addEventListener("mousemove", onmousemove);
      const onmouseup = () => {
        removeEventListener("mousemove", onmousemove);
        this.$nextTick(() => {
          this.dragging = false;
          if (this.id) this.store.set(this.id, "left", this._leftWidth);
        });
      };
      addEventListener("mouseup", onmouseup, {
        once: true,
        capture: true,
      });
    },
    async drag_right_handle(e: MouseEvent) {
      this.dragging = true;
      const b = this._rightWidth;
      const x = e.clientX;
      const onmousemove = (m: MouseEvent) => {
        const diff = m.clientX - x;
        this._rightWidth = this.do_clamp(b - diff);
      };
      addEventListener("mousemove", onmousemove);
      const onmouseup = () => {
        removeEventListener("mousemove", onmousemove);

        this.$nextTick(() => {
          this.dragging = false;
          if (this.id) this.store.set(this.id, "right", this._rightWidth);
        });
      };
      addEventListener("mouseup", onmouseup, {
        once: true,
        capture: true,
      });
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.splitView {
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

.middle {
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

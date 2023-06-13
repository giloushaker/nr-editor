<template>
  <Teleport to="#dialogs" v-show="visible">
    <li ref="context-menu" class="context-menu" :style="style" v-show="visible">
      <slot :payload="payload" />
    </li>
  </Teleport>
</template>

<script lang="ts">
export default {
  name: "ContextMenu",
  data() {
    return {
      left: 100,
      top: 100,
      bottom: 100,
      right: 100,
      width: 200,
      height: 200,
      visible: false,
      isDown: false,
      isRight: false,
      payload: undefined,
    };
  },
  props: {
    modelValue: {
      type: Boolean,
      default: true,
    },
  },
  methods: {
    do_update(e: MouseEvent) {
      this.width = this.el?.clientWidth || this.width;
      this.height = this.el?.clientHeight || this.height;
      this.top = e.clientY;
      this.left = e.clientX;

      if (this.avoid) {
        const avoid = this.avoid as any;
        const avoidLeft = avoid.offsetLeft;
        this.left = avoidLeft + avoid.offsetWidth;
        const target = e.target as HTMLDivElement;
        var targetPos = target.getBoundingClientRect();
        this.top = targetPos.top - 1;
      }

      this.left = Math.min(this.left, window.innerWidth - this.width) + 2;
      this.top = Math.min(this.top, window.innerHeight - 7 - this.height);
      this.bottom = window.innerHeight - this.top;
      this.right = window.innerWidth - this.left;
    },
    update(e: MouseEvent) {
      e.preventDefault();
      this.do_update(e);
      this.$nextTick(() => {
        this.do_update(e);
      });
    },
    show(e: MouseEvent, payload?: any) {
      this.payload = payload;
      this.visible = true;
      this.update(e);
      this.$emit("update:modelValue", true);
    },
    close() {
      this.visible = false;
      this.$emit("update:modelValue", false);
    },
  },
  mounted() {
    addEventListener("click", this.close, { capture: true });
    addEventListener("contextmenu", this.close, { capture: true });
    addEventListener("scroll", this.close, { capture: true });
  },
  unmounted() {
    addEventListener("click", this.close, { capture: true });
    removeEventListener("contextmenu", this.close, { capture: true });
    removeEventListener("scroll", this.close, { capture: true });
  },
  computed: {
    el() {
      return this.$refs["context-menu"] as HTMLDivElement;
    },
    style() {
      const result = {} as Record<string, string>;
      result.top = `${this.top}px`;
      result.left = `${this.left}px`;
      return result;
    },
    avoid() {
      return (this.$el as HTMLDivElement).parentElement?.closest(".context-menu");
    },
  },
};
</script>

<style lang="scss">
@import "@/shared_components/css/vars.scss";
.fixed {
  position: fixed;
}
.context-menu {
  z-index: 10000000;
  display: block;
  // fle x-direction: column;

  position: absolute;
  box-sizing: border-box;
  justify-content: center;
  background-color: $background_color;
  color: $fontColor;
  text-decoration: none;
  font-size: 14px;
  border: 1px solid $box_border;

  min-width: 200px;
  width: fit-content;
  height: fit-content;
  right: 0;
  bottom: 0;

  > div {
    display: flex;
    align-items: center;
    padding: 4px;
  }

  cursor: pointer;

  > :hover,
  > :focus {
    background: $blue;
  }
}
</style>

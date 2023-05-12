<template>
  <Teleport to="#dialogs" v-if="visible">
    <li
      ref="context-menu"
      class="context-menu"
      :style="style"
      @click="update"
      @contextmenu.prevent.capture.stop
    >
      <slot :payload="payload" />
    </li>
  </Teleport>
</template>

<script lang="ts">
import { VueElement } from "nuxt/dist/app/compat/capi";
import { useEditorStore } from "~/stores/editorState";

export default {
  data() {
    return {
      left: 100,
      top: 100,
      bottom: 100,
      right: 100,
      width: 200,
      height: 200,
      isDown: false,
      isRight: false,
      visible: false,
      payload: undefined,
    };
  },
  props: {
    avoid: {
      type: Object as PropType<VueElement | HTMLDivElement>,
    },
  },
  setup() {
    return { store: useEditorStore() };
  },
  methods: {
    update(e: MouseEvent) {
      e.preventDefault();
      this.width = this.el?.clientWidth || this.width;
      this.height = this.el?.clientHeight || this.height;
      this.left = Math.min(e.clientX, window.innerWidth - this.width);
      this.top = Math.min(e.clientY, window.innerHeight - this.height);
      this.bottom = window.innerHeight - this.top;
      this.right = window.innerWidth - this.left;
    },
    show(e: MouseEvent, payload?: any) {
      this.payload = payload;
      if (!this.visible) {
        addEventListener("click", this.close, { capture: true });
        addEventListener("contextmenu", this.close);
      }
      this.visible = true;
      this.store.contextmenu = this as unknown as VueElement;
      this.update(e);
      this.$emit("update:modelValue", true);
    },
    close(e: MouseEvent) {
      this.payload = undefined;
      removeEventListener("click", this.close);
      this.visible = false;
      if (this.store.contextmenu === (this as unknown as VueElement)) {
        this.store.contextmenu = null;
      }
      this.$emit("update:modelValue", false);
    },
  },
  watch: {
    "store.contextmenu"(v) {
      if (v !== this) {
        this.visible = false;
      }
    },
  },
  computed: {
    el() {
      return this.$refs["context-menu"] as HTMLDivElement | undefined;
    },
    style() {
      const result = {} as Record<string, string>;
      result.top = `${this.top}px`;
      result.left = `${this.left}px`;
      return result;
    },
  },
  updated() {},
};
</script>

<style lang="scss">
@import "@/shared_components/css/vars.scss";

.context-menu {
  z-index: 10000000;
  display: block;
  position: absolute;
  box-sizing: border-box;
  background-color: white;
  color: black;
  text-decoration: none;
  font-size: 13px;
  border: 1px solid $gray;

  min-width: 200px;
  width: fit-content;
  height: fit-content;
  right: 0;
  bottom: 0;

  > div {
    padding: 4px;
  }

  cursor: pointer;

  > :hover,
  > :focus {
    background: lightskyblue;
  }
}
</style>

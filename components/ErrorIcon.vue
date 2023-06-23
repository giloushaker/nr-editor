<template>
  <span class="ErrorIcon cursor-pointer mt-auto" v-if="numErrors" :title="errorText">
    <span @click="display()" class="inline-flex align-items gap-4px">
      <img :src="getImage" />
      <span v-if="computedShowNumber">{{ numErrors }}</span>
    </span>

    <div v-if="show" class="fixed bg text">
      <div v-for="error in errors" @click="gotoError(error)" class="border py-3px px-10px hover-darken">
        {{ errorToText(error) }}
      </div>
    </div>
  </span>
</template>
<script lang="ts">
import { PropType } from "vue";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { stripHtml } from "~/assets/shared/util";
import { useEditorStore } from "~/stores/editorStore";
export interface IErrorMessage {
  msg: string;
  severity?: "error" | "warning" | "info" | "debug";
  source?: any;
}
export default {
  name: "ErrorIcon",
  props: {
    errors: {
      type: Array as PropType<IErrorMessage[]>,
      default: [],
    },
    showNumber: {
      type: Boolean,
      default: false,
    },
    clickable: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return { show: this.clickable };
  },
  methods: {
    display() {
      if (!this.clickable) return;
      this.show = true;
      const onClick = () => {
        this.show = false;
      };
      addEventListener("click", onClick, { capture: true, once: true });
    },
    errorToText(error: IErrorMessage): string {
      return stripHtml(error.msg);
    },
    gotoError(error: IErrorMessage) {
      const store = useEditorStore();
      if (error.source) {
        store.goto(error.source);
      } else {
        console.warn(`Couldn't goto error: no source attached`);
      }
      this.show = false;
    },
  },
  computed: {
    computedShowNumber(): boolean {
      if (this.showNumber === false || this.showNumber === undefined || this.showNumber === null) return false;
      return true;
    },
    getImage(): string {
      let hasWarnings = this.errors!.find((o) => o.severity === "warning");
      let hasErrors = this.errors!.find((o) => !o.severity || o.severity === "error");
      let hasInfos = this.errors!.find((o) => !o.severity || o.severity === "info");
      if (hasErrors) return "./assets/icons/error_exclamation.png";
      if (hasWarnings) return "./assets/icons/warning_exclamation.png";
      if (hasInfos) return "./assets/icons/info_exclamation.png";
      return "./assets/icons/error_exclamation.png";
    },
    numErrors(): number {
      return this.errors?.length || 0;
    },
    errorText(): string {
      return sortByAscending(this.errors || [], (o) => o.msg)
        .map((o) => `• ${this.errorToText(o)}\n`)
        .join("")
        .trim();
    },
  },
};
</script>
<style scoped>
img {
  vertical-align: middle;
  top: -1px;
  position: relative;
}
</style>

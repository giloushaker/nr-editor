<template>
  <span class="ErrorIcon" v-if="numErrors" :title="errorText">
    <img :src="getImage" />
    <span v-if="computedShowNumber">{{ numErrors }}</span>
  </span>
</template>
<script lang="ts">
import { PropType } from "vue";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { stripHtml } from "~/assets/shared/util";
export interface IErrorMessage {
  msg: string;
  severity?: "error" | "warning" | "info" | "debug";
}
export default {
  name: "ErrorIcon",
  props: {
    errors: Array as PropType<IErrorMessage[]>,
    showNumber: Boolean,
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
        .map((o) => `• ${stripHtml(o.msg)}\n`)
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

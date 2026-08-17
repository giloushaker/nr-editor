<template>
  <input v-model="dateString" type="date" @change="change" />
</template>
<script>
import { dateFormat } from "@/assets/shared/util.ts";

export default {
  props: ["modelValue"],
  data() {
    return {
      dateString: null,
    };
  },

  created() {
    let val = this.modelValue;
    if (val == null) {
      this.dateString = this.dateFormat(new Date());
    } else {
      this.dateString = this.dateFormat(this.modelValue);
    }
  },

  methods: {
    change() {
      this.$emit("update:modelValue", new Date(this.dateString));
    },

    dateFormat(date) {
      if (typeof date === "string") {
        date = new Date(date);
      }

      const year = date.getUTCFullYear().toString().padStart(4, "0");
      const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
      const day = date.getUTCDate().toString().padStart(2, "0");

      return `${year}-${month}-${day}`;
    },
  },
};
</script>

<template>
  <div
    :placeholder="placeholder"
    class="editableDiv"
    @input="change"
    @paste="onpaste"
    contenteditable="true"
    ref="div"
  ></div>
</template>

<script lang="ts">
export default {
  emits: ["change", "update:modelValue"],
  props: {
    modelValue: {
      type: [String, Number, Array],
    },
    placeholder: {
      type: String,
      default: "",
    },
  },

  methods: {
    change(e: any) {
      if (e.target) {
        this.$emit("update:modelValue", e.target.outerText);
        this.$emit("change");
      }
    },

    toHtml(s: string) {
      return s.replace(/\n/g, "<br />");
    },

    onpaste(e: Event) {
      e.preventDefault();
      var text = (e as any).clipboardData.getData("text/plain");
      (this.$refs.div as any).innerText = text || "";
      this.$emit("update:modelValue", text);
      this.$emit("change");
    },
  },

  mounted() {
    (this.$refs.div as any).innerText = this.modelValue || "";
  },

  watch: {
    modelValue() {
      if ((this.$refs.div as any).innerText != this.modelValue) {
        (this.$refs.div as any).innerText = this.modelValue;
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.editableDiv {
  border: 1px $box_border solid;
  padding: 3px;
  text-align: left;
  background-color: $background_color;
}

[contentEditable="true"]:empty:not(:focus):before {
  content: attr(data-text);
  color: $gray;
  font-style: italic;
}

.editableDiv[placeholder]:empty:before {
  content: attr(placeholder);
  color: #555;
}

.editableDiv[placeholder]:empty:focus::before {
  content: "";
}
</style>

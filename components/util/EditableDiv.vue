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
    get() {
      return this.$refs.div as HTMLDivElement;
    },
    toHtml(s: string) {
      return s.replace(/\n/g, "<br />");
    },

    onpaste(e: ClipboardEvent) {
      e.preventDefault();
      // Get the copied text from the clipboard
      /** https://htmldom.dev/paste-as-plain-text/ */
      const text = e.clipboardData!.getData("text/plain");

      // Insert text at the current position of caret
      const range = document.getSelection()!.getRangeAt(0);
      range.deleteContents();

      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.selectNodeContents(textNode);
      range.collapse(false);

      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      this.$emit("update:modelValue", this.get().innerText);
      this.$emit("change");
    },
  },

  mounted() {
    this.get().innerText = `${this.modelValue ?? ""}`;
  },

  watch: {
    modelValue() {
      if (this.get().innerText != this.modelValue) {
        this.get().innerText = `${this.modelValue ?? ""}`;
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

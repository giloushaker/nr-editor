<template>
  <component
    :is="is"
    :placeholder="placeholder"
    class="editableDiv"
    @input="change"
    @paste="onpaste"
    contenteditable="true"
    ref="div"
  >
  </component>
</template>

<script lang="ts">
export default {
  emits: ["change", "update:modelValue", "paste"],
  props: {
    modelValue: {
      type: [String, Number, Array],
    },
    placeholder: {
      type: String,
      default: "",
    },
    is: {
      type: String,
      default: "div",
    },
    beforePaste: Function,
  },

  methods: {
    change(e: any) {
      if (e.target) {
        this.$emit("update:modelValue", e.target.innerText);
        const event = new CustomEvent("change", {
          bubbles: true,
        });
        this.$el?.dispatchEvent(event);
      }
    },
    get() {
      return this.$refs.div as HTMLDivElement;
    },
    toHtml(s: string) {
      return s.replace(/\n/g, "<br />");
    },
    decodeHtml(html: string) {
      var txt = document.createElement("textarea");
      txt.innerHTML = html;
      return txt.value;
    },
    onpaste(e: ClipboardEvent) {
      e.preventDefault();
      var text = this.decodeHtml(e.clipboardData?.getData("text/plain") ?? "");
      if (this.beforePaste) {
        text = this.beforePaste(text);
      }
      document.execCommand("insertText", false, text);
      this.$emit("update:modelValue", this.get().innerText);
      const event = new CustomEvent("change", {
        bubbles: true,
      });
      this.$el?.dispatchEvent(event);
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
  background-color: $input_background;
  min-width: 80px;
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

<template>
  <input v-model="stringValue" type="number" @change="update" :required="required" :min="min" :max="max" step="any" />
</template>

<script lang="ts">
export default {
  props: {
    modelValue: {
      type: [Number, String],
    },
    required: {
      type: Boolean,
      required: false,
    },
    min: {
      type: Number,
      required: false,
    },
    max: {
      type: Number,
      required: false,
    },
  },
  data() {
    return {
      stringValue: null as string | null,
      intValue: 0,
    };
  },

  watch: {
    modelValue() {
      this.refresh();
    },
  },

  created() {
    this.refresh();
  },

  methods: {
    refresh() {
      this.intValue = this.modelValue || 0;
      this.stringValue = "" + this.modelValue;
    },

    update() {
      if (this.stringValue != null) {
        this.intValue = parseFloat(this.stringValue);
        this.$emit("update:modelValue", this.intValue);
        const event = new CustomEvent("change", {
          bubbles: true,
        });
        this.$el?.dispatchEvent(event);
      }
    },
  },
};
</script>

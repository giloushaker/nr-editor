<template>
  <input
    v-model="stringValue"
    type="number"
    @change="update"
    :required="required"
    :min="min"
    :max="max"
  />
</template>

<script lang="ts">
export default {
  props: {
    modelValue: {
      type: Number,
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
        this.intValue = parseInt(this.stringValue);
        this.$emit("update:modelValue", this.intValue);
        this.$emit("change");
      }
    },
  },
};
</script>

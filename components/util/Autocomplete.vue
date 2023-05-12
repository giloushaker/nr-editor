<template>
  <div class="autocomplete container">
    <input
      class="input autocomplete-input"
      type="text"
      @input="suggest"
      @click="maySuggest"
      @change="changed"
      v-model="searchPattern"
      :placeholder="placeholder"
      v-click-outside="onClickOutside"
    />
    <div
      class="suggestions"
      ref="suggestions"
      @click.capture="clickedOption"
      :class="{ hidden: !editing }"
    >
      <slot :editing="editing"> </slot>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    modelValue: String,
    placeholder: String,
    min: {
      type: Number,
      default: 3,
    },
  },

  created() {
    if (this.modelValue) {
      this.searchPattern = this.modelValue;
    }
  },

  data() {
    return {
      searchPattern: "",
      lastSearch: null as string | null,
      editing: false,
      el: null,
      elements: [] as HTMLDivElement[],
    };
  },
  mounted() {
    this.el = this.$el;
  },
  updated() {
    this.el = this.$el;
  },
  watch: {
    searchPattern(val) {
      if (this.editing) {
        this.$emit("update:modelValue", val);
      }
    },
  },
  methods: {
    reset() {
      this.searchPattern = "";
    },

    onClickOutside() {
      this.editing = false;
    },

    async suggest() {
      if (this.searchPattern.length < this.min) {
        this.editing = false;
      } else {
        this.editing = true;
      }
    },

    maySuggest() {
      this.searchPattern = "";
      if (this.min == 0) {
        this.suggest();
      }
    },

    clicked() {
      this.editing = false;
    },
  },
};
</script>

<style lang="scss">
.suggestions {
  position: absolute;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1;
  width: 100%;
  padding-top: 2px;
  display: grid;
  box-shadow: rgba(22, 1, 1, 0.74) 0px 3px 8px;

  > * {
    background-color: white;
    border-left: 1px black solid;
    border-right: 1px black solid;
    border-bottom: none;
    padding: 5px;

    &:last-child {
      border-bottom: 1px black solid;
    }

    &:first-child {
      border-top: 1px black solid;
    }

    &:hover {
      background-color: rgb(218, 227, 241);
    }
  }
}

.container {
  position: relative;
}

.input {
  width: 100%;
}

.hidden {
  display: none;
}
</style>

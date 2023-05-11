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
      v-if="
        suggestionList &&
        suggestionList.length &&
        searchPattern.length >= min &&
        editing
      "
    >
      <label
        class="suggestion"
        v-for="sugg in suggestionList"
        @click="clicked(sugg)"
      >
        {{ resultLabel(sugg) }}
      </label>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    modelValue: String,
    placeholder: String,
    search: {
      type: Function,
      required: true,
    },
    resultLabel: {
      type: Function,
      required: true,
    },
    resultValue: {
      type: Function,
      required: true,
    },
    min: {
      type: Number,
      default: 3,
    },
    extra: {
      type: Array,
      default: [],
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
      suggestions: [] as any[],
      editing: false,
    };
  },

  methods: {
    onClickOutside() {
      if (this.extra.length == 0) {
        this.editing = false;
      }
    },

    async suggest() {
      if (this.searchPattern.length < this.min) {
        this.suggestions = [];
        this.editing = false;
      } else {
        this.suggestions = await this.search(this.searchPattern);
        this.editing = true;
      }
    },

    maySuggest() {
      this.searchPattern = "";
      if (this.min == 0) {
        this.suggest();
      }
    },

    clicked(sugg: any) {
      let res = this.resultValue(sugg);
      if (res) {
        this.searchPattern = res;
      }
      this.suggestions = [];
      this.$emit("selected", sugg);
      this.editing = false;
    },

    changed() {
      this.$emit("update:modelValue", this.searchPattern);
    },

    close() {
      this.suggestions = [];
    },
  },

  computed: {
    suggestionList(): any[] {
      return this.suggestions.concat(this.extra);
    },
  },
};
</script>

<style lang="scss">
.suggestions {
  position: absolute;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  width: 100%;
  padding-top: 2px;
  display: grid;
  box-shadow: rgba(22, 1, 1, 0.74) 0px 3px 8px;

  .suggestion {
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
</style>

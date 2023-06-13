<template>
  <div class="autocomplete container">
    <input
      class="input autocomplete-input"
      type="text"
      ref="edit"
      @input="suggest"
      @click="maySuggest"
      v-model="searchPattern"
      :placeholder="placeholder"
      v-click-outside="onClickOutside"
      v-if="editing"
    />
    <div v-else @click="startEditing" class="autocomplete-input">
      <span class="gray" v-if="!selectedOption">{{ placeholder }}</span>
      <slot v-else v-bind="selectedOption" name="option"></slot>
    </div>
    <div class="suggestions" :class="{ hidden: !editing }">
      <div v-for="option of foundOptions" @click="targetSelected(option)">
        <slot v-bind="option" name="option"></slot>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from "nuxt/dist/app/compat/capi";

export default {
  props: {
    modelValue: String,
    placeholder: {
      type: String,
      default: "Search...",
    },

    min: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 1000,
    },

    options: {
      type: [Array, Function],
      required: true,
    },

    valueField: {
      type: String,
      default: "",
    },

    filterField: {
      type: String,
      default: "",
    },

    lazy: {
      type: Boolean,
      default: false,
    },

    default: {
      type: Object as PropType<any>,
    },
  },

  created() {
    if (!this.lazy) {
      this.reset();
    } else {
      this.selectedOption = { option: this.default, selected: true };
    }
  },

  data() {
    return {
      searchPattern: "",
      lastSearch: null as string | null,
      editing: false,
      selectedOption: null as { option: any; selected?: boolean } | null,
      sleeping: this.lazy,
    };
  },

  computed: {
    computedOptions(): any[] {
      if (Array.isArray(this.options)) return this.options;
      return this.sleeping ? [] : this.options();
    },
    foundOptions(): { option: any }[] {
      const regex = this.textSearchRegex(this.searchPattern);

      const result = [];
      const data = this.computedOptions;
      const end = this.max || data.length;
      for (let i = 0; i < data.length; i++) {
        const cur = data[i];
        let val = this.filterField ? cur[this.filterField] : cur;
        if (val && val.match && val.match(regex)) {
          result.push({ option: cur });
          if (result.length >= end - 1) break;
        }
      }
      return result;
    },
  },

  methods: {
    escapeRegex(str: string) {
      return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
    },

    textSearchRegex(query: string) {
      const words = this.escapeRegex(query).split(" ");
      const regexStr = `^(?=.*\\b${words.join(".*)(?=.*\\b")}).*$`;
      const regx = new RegExp(regexStr, "i");
      return regx;
    },

    targetSelected(opt: any) {
      let res = opt.option;
      if (this.valueField.length) {
        res = opt.option[this.valueField];
      }
      this.selectedOption = {
        option: opt.option,
        selected: true,
      };
      this.$emit("update:modelValue", res);
      this.$emit("change");
    },

    reset() {
      this.searchPattern = "";
      this.selectedOption = null;
      if (this.modelValue) {
        let found = this.computedOptions.find((opt: any) => {
          let item = opt;
          if (this.valueField) {
            item = opt[this.valueField];
          }
          if (item === this.modelValue) {
            return true;
          }
          return false;
        });
        if (found) {
          this.selectedOption = {
            option: found,
            selected: true,
          };
        } else {
          this.selectedOption = null;
        }
      }
    },

    onClickOutside() {
      this.editing = false;
    },

    suggest() {
      if (this.searchPattern.length < this.min) {
        this.editing = false;
      } else {
        this.startEditing();
      }
    },

    maySuggest() {
      this.sleeping = false;
      this.searchPattern = "";
      if (this.min == 0) {
        this.suggest();
      }
    },

    clicked() {
      this.editing = false;
    },

    startEditing() {
      if (!this.editing) {
        this.sleeping = false;
        this.editing = true;
        this.searchPattern = "";
      }
    },
  },

  watch: {
    options() {
      if (!this.lazy) {
        this.reset();
      } else {
        this.selectedOption = { option: this.default, selected: true };
      }
    },

    modelValue() {
      if (!this.editing) {
        if (!this.lazy) {
          this.reset();
        } else {
          this.selectedOption = { option: this.default, selected: true };
        }
      }
    },

    async editing() {
      if (this.editing) {
        await this.$nextTick();
        if (this.$refs.edit) {
          (this.$refs.edit as any).focus();
        }
      }
    },
  },
};
</script>

<style lang="scss">
@import "@/shared_components/css/vars.scss";

.suggestions {
  position: absolute;
  top: 100%;
  margin-top: 3px;
  max-height: 300px;

  overflow-y: auto;
  z-index: 1;
  width: 100%;
  display: grid;
  box-shadow: rgba(22, 1, 1, 0.74) 0px 3px 8px;
  border-top: 1px $box_border;
  border-bottom: 1px $box_border;
  > * {
    background-color: var(--input-background);
    border-left: 1px $box_border;
    border-right: 1px $box_border;
    border-bottom: none;
    padding: 5px;

    &:hover {
      background-color: $blue;
    }
  }
}

.view {
  background-color: var(--input-background);
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

.autocomplete-input::before {
  content: "";
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #000;
}
</style>

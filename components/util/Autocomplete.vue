<template>
  <div class="autocomplete container">
    <input
      class="input autocomplete-input"
      type="text"
      ref="edit"
      @input="suggest"
      @click="maySuggest"
      @change="changed"
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
export default {
  props: {
    modelValue: Object,
    placeholder: {
      type: String,
      default: "Search...",
    },

    min: {
      type: Number,
      default: 0,
    },

    options: {
      type: Array,
      required: true,
      default: [],
    },

    valueField: {
      type: String,
      default: "",
    },

    filterField: {
      type: String,
      default: "",
    },
  },

  created() {
    this.reset();
  },

  data() {
    return {
      searchPattern: "",
      lastSearch: null as string | null,
      editing: false,
      selectedOption: null as { option: any } | null,
    };
  },

  computed: {
    foundOptions(): { option: any }[] {
      const regex = this.textSearchRegex(this.searchPattern);

      const res = this.options
        .filter((opt) => {
          let val: any = opt;
          if (this.filterField) {
            val = val[this.filterField];
          }
          if (val.match && val.match(regex)) {
            return true;
          }
          return false;
        })
        .map((elt: any) => {
          return { option: elt };
        });
      return res;
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
      this.selectedOption = opt;
      this.$emit("update:modelValue", res);
      this.$emit("change");
    },

    reset() {
      this.searchPattern = "";
      if (this.modelValue) {
        let found = this.options.find((opt: any) => {
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
          };
        }
      }
    },

    onClickOutside() {
      this.editing = false;
    },

    async suggest() {
      if (this.searchPattern.length < this.min) {
        this.editing = false;
      } else {
        this.startEditing();
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

    async startEditing() {
      this.editing = true;
      this.searchPattern = "";
    },
  },

  watch: {
    options() {
      this.reset();
    },

    modelValue() {
      if (!this.editing) {
        this.reset();
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

.view {
  background-color: white;
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

<template>
  <div class="container">
    <div @click="startEditing" class="iconselect-input" v-click-outside="onClickOutside">
      <span class="gray" v-if="!selectedOption">{{ placeholder }}</span>
      <slot v-else v-bind="selectedOption" name="option"></slot>
    </div>

    <div class="suggestions" :class="{ hidden: !editing }">
      <div v-for="option of availableOptions" @click="targetSelected(option)">
        <slot v-bind="option" name="option"></slot>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from "vue";

type OptionArray = Array<{ option: any; selected?: boolean }>;

export default {
  props: {
    modelValue: {
      type: Object as PropType<any>,
    },

    placeholder: {
      type: String,
      default: "Search...",
    },

    fetch: {
      type: Function,
      required: true,
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
      selectedOption: null as { option: any; selected?: boolean } | null,
      availableOptions: [] as OptionArray,
    };
  },

  methods: {
    async foundOptions(): Promise<OptionArray> {
      const res = await this.fetch();
      return res.map((elt: any) => {
        return { option: elt };
      });
    },

    targetSelected(opt: any) {
      let res = opt.option;
      this.selectedOption = {
        option: opt.option,
        selected: true,
      };
      this.$emit("update:modelValue", res);
      this.$emit("change", opt.option);
      this.editing = false;
    },

    reset() {
      this.searchPattern = "";
      this.selectedOption = null;
      if (this.modelValue) {
        this.selectedOption = {
          option: this.modelValue,
          selected: true,
        };
      }
    },

    onClickOutside() {
      this.editing = false;
    },

    async startEditing() {
      this.editing = true;
      this.availableOptions = (await this.foundOptions()) as Array<{ option: any; selected?: boolean }>;
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
  top: 100%;
  margin-top: 3px;
  max-height: 300px;

  overflow-y: auto;
  z-index: 1;
  width: 100%;
  display: grid;
  box-shadow: rgba(22, 1, 1, 0.74) 0px 3px 8px;
  border-top: 1px gray solid;
  border-bottom: 1px gray solid;

  > * {
    background-color: white;
    border-left: 1px gray solid;
    border-right: 1px gray solid;
    border-bottom: none;
    padding: 5px;

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

.container {
  input {
    height: 33px;
  }
}

.iconselect-input {
  background-color: white;
  width: 100% !important;
  padding-right: 30px;
}

.iconselect-input::before {
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

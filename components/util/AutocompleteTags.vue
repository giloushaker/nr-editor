<template>
  <div class="autocomplete relative" @keydown.down.prevent="onDown" @keydown.up.prevent="onUp"
    @keydown.enter.prevent="onEnter" @keyup.enter.prevent="onEnterUp" @keydown.escape="blur()">
    <input class="input autocomplete-input" type="text" ref="edit" autofocus @input="suggest" @click="maySuggest"
      @focus="startEditing" v-model="searchPattern" :placeholder="placeholder" v-click-outside="onClickOutside"
      v-if="editing" />
    <div v-else @click="startEditing" class="autocomplete-input">
      <span class="gray">{{ placeholder }}</span>
      <span class="float-right bold">+</span>
    </div>
    <div class="suggestions" v-show="editing" :class="{ hidden: !editing }" ref="suggestions">
      <template v-for="(option, i) in foundOptions">
        <div class="suggestion selected" v-if="i === boundedSelected" @click.capture.stop="targetSelected(option)"
          @contextmenu.capture="targetSelectedRightClick($event, option)">
          <slot v-bind="{ ...option, selected: true }" name="option"></slot>
        </div>
        <div class="suggestion" v-else @click.stop="targetSelected(option)"
          @contextmenu.prevent="targetSelectedRightClick($event, option)">
          <slot v-bind="option" name="option"></slot>
        </div>
      </template>
      <div v-if="always" class="suggestion" :class="{ selected: selected === foundOptions.length }"
        @click="$emit('always', searchPattern)" @contextmenu.prevent="$emit('always-special', searchPattern)">
        <slot name="always" v-bind="{ input: searchPattern }"></slot>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { start } from "repl";
import { PropType } from "vue";
import { inBounds } from "~/assets/shared/battlescribe/bs_helpers";

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

    filterField: {
      type: [String, Function],
      default: "",
    },

    lazy: {
      type: Boolean,
      default: false,
    },
    focus: {
      type: Boolean,
      default: false,
    },

    nullable: {
      type: Boolean,
      default: false,
    },

    always: {
      type: Boolean,
      default: false,
    },
  },

  created() {
    if (!this.lazy) {
      this.reset();
    }
  },

  data() {
    return {
      searchPattern: "",
      selected: 0,
      lastSearch: null as string | null,
      editing: false,
      sleeping: this.lazy,
      bounce: false,
    };
  },

  computed: {
    boundedSelected() {
      return inBounds(this.selected, 0, this.always ? this.foundOptions.length : this.foundOptions.length - 1);
    },
    computedOptions(): any[] {
      if (Array.isArray(this.options)) return this.options;
      return this.sleeping ? [] : this.options();
    },
    foundOptions(): { option: any }[] {
      const regex = this.textSearchRegex(this.searchPattern);
      const result = [];
      if (this.nullable) {
        result.push({ option: undefined });
      }
      const data = this.computedOptions;
      const end = this.max || data.length;
      for (let i = 0; i < data.length; i++) {
        const cur = data[i];
        let val = this.getField(cur);
        if (val && val.match && val.match(regex)) {
          result.push({ option: cur });
          if (result.length >= end - 1) break;
        }
      }
      return result;
    },
  },

  methods: {
    fix(n: number) {
      return inBounds(n, 0, this.always ? this.foundOptions.length : this.foundOptions.length - 1);
    },
    blur() {
      this.editing = false;
      this.$emit("blur");
    },
    onUp() {
      this.selected = this.fix(this.selected - 1);
      this.$nextTick(() => {
        const el = (this.$refs.suggestions as HTMLDivElement)!.getElementsByClassName("selected")[0];
        el?.scrollIntoView({ block: "nearest", inline: "center" });
      });
    },
    onDown() {
      this.selected = this.fix(this.selected + 1);
      this.$nextTick(() => {
        const el = (this.$refs.suggestions as HTMLDivElement)!.getElementsByClassName("selected")[0];
        el?.scrollIntoView({ block: "nearest", inline: "center" });
      });
    },
    onEnter() {
      if (this.bounce) return;
      this.bounce = true;
      if (this.always && this.selected === this.foundOptions.length) {
        this.$emit("always", this.searchPattern);
      } else {
        this.targetSelected(this.foundOptions[this.boundedSelected]);
      }
      this.reset();
    },
    onEnterUp() {
      this.bounce = false;
    },
    getField(cur: any) {
      if (!this.filterField) return cur;
      if (this.filterField instanceof Function) {
        return this.filterField(cur);
      }
      return cur[this.filterField];
    },
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
      console.log("selected", opt);
      this.$emit("add", opt.option);
    },

    targetSelectedRightClick(event: Event, opt: any) {
      event.preventDefault();
      event.stopPropagation();

      console.log("selected (right click)", opt);
      this.$emit("add-special", opt.option);
    },

    reset() {
      this.searchPattern = "";
    },

    onClickOutside() {
      this.blur();
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

    startEditing() {
      if (!this.editing) {
        this.sleeping = false;
        this.editing = true;
        this.searchPattern = "";
      }
    },
  },

  mounted() {
    if (this.focus) {
      setTimeout(() => {
        (this.$refs.edit as HTMLInputElement)?.focus();
        this.startEditing();
      }, 0);
    }
  },
  watch: {
    options() {
      if (!this.lazy) {
        this.reset();
      }
    },
    searchPattern(_new, _old) {
      if ((_new ?? "") !== (_old ?? "")) {
        this.selected = 0;
        this.$emit("update:modelValue", _new);
        this.$emit("change");
      }
    },
    modelValue: {
      immediate: true,
      handler(v) {
        this.searchPattern = v ?? "";
      },
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

<style lang="scss" scoped>
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
  background-color: var(--input-background);
  border-top: 1px $box_border;
  border-bottom: 1px $box_border;

  >* {
    background-color: var(--input-background);
    border-left: 1px $box_border;
    border-right: 1px $box_border;
    border-bottom: none;
    padding: 5px;

    &:hover {
      background-color: $blue;
    }
  }

  // overflow-x: hidden;
}

.suggestions {
  cursor: pointer !important;
}

.suggestion.selected {
  background-color: $blue;
  color: white;
  fill: white;

  :deep(.icon) {
    filter: unset !important;
  }
}

.suggestion:hover {
  background-color: var(--input-highlights);
  color: white;
  fill: white;

  :deep(.icon) {
    filter: unset !important;
  }

}

.view {
  background-color: var(--input-background);
}

.container {
  position: relative;
}

.hidden {
  display: none;
}

// .autocomplete-input::before {
//   content: "";
//   position: absolute;
//   top: 50%;
//   right: 10px;
//   transform: translateY(-50%);
//   width: 0;
//   height: 0;
//   border-left: 5px solid transparent;
//   border-right: 5px solid transparent;
//   border-top: 5px solid #000;
//   filter: var(--image-filter);
// }
.autocomplete-input,
.autocomplete {
  min-width: 300px;
}
</style>

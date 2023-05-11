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
    <div class="suggestions" ref="suggestions" :class="{ hidden: !editing }">
      <slot> </slot>
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
    el(el) {
      this.update();
    },
    elements(opts: Element[]) {
      opts.map((o) => {
        if (!o.getAttribute("listener")) {
          o.addEventListener("click", (e) => this.clickedOption(e, o), {
            capture: true,
          });
          o.setAttribute("listener", "true");
        }
      });
    },
  },
  methods: {
    update() {
      if (!this.$el) return;
      const suggestionsDiv = this.$refs.suggestions as Element | undefined;
      if (!suggestionsDiv) return;
      if (this.searchPattern !== this.lastSearch) {
        this.lastSearch = this.searchPattern;
        this.elements = [...(suggestionsDiv.getElementsByTagName("div") || [])];
      }
    },
    onClickOutside() {
      if (this.extra.length == 0) {
        this.editing = false;
      }
    },

    async suggest() {
      if (this.searchPattern.length < this.min) {
        this.editing = false;
      } else {
        this.editing = true;
      }
      this.update();
    },

    maySuggest() {
      this.searchPattern = "";
      if (this.min == 0) {
        this.suggest();
      }
      this.$nextTick(() => {
        this.$nextTick(() => {
          this.update();
        });
      });
    },

    clicked(selected: any, label: string) {
      this.searchPattern = label;
      this.suggestions = [];
      this.$emit("selected", selected);
      this.editing = false;
    },

    clickedOption(event: MouseEvent, clicked: any) {
      event.stopPropagation();
      event.preventDefault();
      // console.log(elt, elt.__vnode);
      if (clicked.__vnode) {
        this.clicked(clicked.__vnode.props.value, clicked.innerText);
      } else if (clicked.value) {
        this.clicked(clicked.value, clicked.innerText);
      } else {
        this.clicked(clicked.innerText, clicked.innerText);
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

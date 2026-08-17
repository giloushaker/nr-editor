<template>
  <div class="tag-select">
    <select ref="el" id="el" v-bind="$attrs" :value="modelValue" class="ts-select">
      <slot />
    </select>
  </div>
</template>
<script setup lang="ts">
// https://github.com/orchidjs/tom-select/discussions/147
import { ref, onMounted, onUnmounted, watch, type PropType } from "vue";
import TomSelect from "tom-select";
import "tom-select/dist/scss/tom-select.scss";
import { TomSettings } from "tom-select/dist/esm/types/settings.js";

const emit = defineEmits<{
  (e: "change", values: string[] | string): void;
  (e: "input", values: string[] | string): void;
  (e: "update:modelValue", values: string[] | string): void;
}>();

const props = defineProps({
  modelValue: {
    type: [String, Array] as PropType<string | string[]>,
    default: () => [],
  },
  options: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  allowCreate: {
    type: Boolean,
    default: false,
  },
  createText: {
    type: String,
    default: 'Create "{input}"',
  },
  width: {
    type: String,
    required: false,
  },
});

const el = ref<HTMLSelectElement | null>(null);
const select = ref<TomSelect | null>(null);
const optionsSet = ref(new Set<string>());

onMounted(() => {
  if (!el.value) return;

  try {
    const config = {
      plugins: ["remove_button"],
      delimiter: ",", // Allow comma-separated values
      persist: false, // Don't persist dropdown after selection
      hidePlaceholder: true,
      dropdownParent: "body", // Render dropdown at body level to avoid clipping
      create:
        props.allowCreate &&
        ((input: string, callback?: Function) => {
          const newItem = {
            value: input,
            text: input,
          };
          if (callback) callback(newItem);
          return newItem;
        }),
      onChange: (values: string[]) => {
        if (Array.isArray(values)) {
          emit("update:modelValue", [...values]);
          emit("change", [...values]);
        } else {
          emit("update:modelValue", values);
          emit("change", values);
        }
      },
      render: {
        option_create: (data: any, escape: (str: string) => string) => {
          return `<div class="create">${props.createText.replace("{input}", escape(data.input))}</div>`;
        },
      },
    };
    select.value = new TomSelect(el.value, config as unknown as TomSettings);

    // Add initial options
    if (props.options?.length) {
      select.value.addOptions(props.options.map((o) => ({ value: o, text: o })));
    }

    // Set initial values
    if (Array.isArray(props.modelValue) && props.modelValue.length) {
      select.value.addOptions(props.modelValue.map((o) => ({ value: o, text: o })));
      select.value.addItems(props.modelValue, true);
    }

    props.options.forEach((option) => optionsSet.value.add(option));
  } catch (error) {
    console.error("Failed to initialize TomSelect:", error);
  }
});

onUnmounted(() => {
  if (select.value) {
    select.value.destroy();
  }
});

watch(
  () => props.options,
  (cur, prev) => {
    if (!select.value) return;

    const prev_set = new Set(prev || []);
    const cur_set = new Set(cur || []);
    optionsSet.value = cur_set;
    const selected_set = new Set(select.value.items);

    // Add new options
    for (const val of cur || []) {
      if (!prev_set.has(val)) {
        select.value.addOption({ value: val, text: val });
      }
    }

    // Remove old options that are not selected
    for (const val of prev || []) {
      if (!cur_set.has(val) && !selected_set.has(val)) {
        select.value.removeOption(val);
      }
    }
  },
);

watch(
  () => props.modelValue,
  (cur, prev) => {
    if (!select.value) return;

    const prevArray = Array.isArray(prev) ? prev : [];
    const curArray = Array.isArray(cur) ? cur : [];
    const prev_set = new Set(prevArray);
    const cur_set = new Set(curArray);

    // Add new items
    for (const val of curArray) {
      if (!prev_set.has(val)) {
        select.value.addOption({ value: val, text: val });
        select.value.addItem(val, true);
      }
    }

    // Remove old items
    for (const val of prevArray) {
      if (!cur_set.has(val)) {
        select.value.removeItem(val);
        if (!optionsSet.value.has(val)) {
          select.value.removeOption(val);
        }
      }
    }
  },
);
</script>

<style lang="scss">
@use "@/shared_components/css/vars.scss" as *;

$select-color-input: pink !important;

.ts-control,
.ts-wrapper.single.input-active .ts-control {
  background: $input_background;
}
.ts-control {
  min-height: 44px;
}
.ts-dropdown {
  background: $input_background;
  z-index: 10000 !important; // Higher than PopupDialog (1001)
}
.ts-dropdown .active {
  background-color: Highlight;
  color: HighlightText;
}
.ts-dropdown .active.create {
  color: HighlightText;
}
.ts-dropdown,
.ts-control,
.ts-control input {
  color: $fontColor;
  font-size: $fontSize;
  border: 1px solid $box_border;
}
.ts-wrapper .ts-control {
  padding: calc(8px - 2px - 0px) 8px calc(8px - 2px - 3px - 0px);
}

.ts-control:hover {
  border: 1px solid Highlight;
}
.ts-control > input {
  max-height: 10px;
}
.ts-wrapper.multi .ts-control > div,
.ts-wrapper.multi .ts-control > div.active {
  color: $fontColor;
  font-size: $fontSize;
  background: $input_background;
  border: 1px solid $box_border;
  border-radius: 5px;
  padding: 4px;
}
.ts-wrapper.plugin-remove_button:not(.rtl) .item .remove {
  border-left: 1px solid $box_border;
}
.ts-wrapper.multi .ts-control > div {
  margin: 3px;
}
.ts-wrapper.plugin-remove_button .item .remove:hover {
  border-radius: 5px;
  background-color: Highlight;
  color: HighlightText;
}
.ts-dropdown-content {
  scrollbar-width: thin;
}
.ts-select > option {
  display: none;
}
.tag-select {
  min-width: v-bind(width);
}
.ts-wrapper {
  width: 100%;
}
// Style for create option
.create {
  font-style: italic;
  color: $input_highlights;
  padding: 4px 8px;

  &:hover {
    background-color: $input_highlights;
    color: white;
  }
}
</style>

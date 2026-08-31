<template>
  <tr>
    <td :class="{ hastooltip: Boolean(title) }" :title="title">{{ label }}<template v-if="label">:</template></td>
    <td>
      <slot>
        <EditorFieldControl v-bind="controlProps" />
      </slot>
    </td>
  </tr>
</template>

<script lang="ts">
import EditorFieldControl from "./EditorFieldControl.vue";
import { fieldControlProps } from "./props";

/**
 * One labelled row in an .editorTable.
 *
 * Replaces the `<tr><td>Label:</td><td><input v-model="item.x" /></td></tr>` block that was
 * copied across the right panel. Use EditorFieldControl directly where the layout isn't a
 * table row, or fill the default slot to keep the label and supply your own control.
 */
export default {
  name: "EditorField",
  components: { EditorFieldControl },
  props: {
    ...fieldControlProps,
    label: { type: String, default: "" },
    title: { type: String, default: "" },
  },
  computed: {
    /** label/title style the row, not the control -- don't leak them onto the input. */
    controlProps() {
      const { label, title, ...rest } = this.$props;
      return rest;
    },
  },
};
</script>

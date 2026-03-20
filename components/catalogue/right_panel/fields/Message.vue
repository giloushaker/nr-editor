<template>
  <fieldset>
    <legend>
      Message
      <InfoButton>
        <p>Used to replace the default, often confusing error message with something more specific.</p>
        <p>Put a valid scope within {} to have it automatically substituted.</p>
        <p>
          <strong>Scope substitutions:</strong> {self} {group} {parent} {primary-category} {roster} {root-entry} {model}
          {upgrade} {unit} {model-or-unit} {link}
        </p>
        <p> <strong>Value substitutions:</strong> {of} {scope} {current} {value} {total} {field} {difference} </p>
        <p>Any text such as **text** will be bolded</p>
      </InfoButton>
    </legend>
    <UtilEditableDiv v-model="message" />
  </fieldset>
</template>

<script lang="ts">
import type { Constraint } from "~/assets/shared/battlescribe/bs_main";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import InfoButton from "~/components/InfoButton.vue";
export default {
  components: { InfoButton },
  props: {
    item: { type: Object as PropType<Constraint & EditorBase>, required: true },
  },
  computed: {
    message: {
      get(): string {
        return this.item.message || "";
      },
      set(str: string) {
        this.item.message = str ? str : undefined;
      },
    },
  },
};
</script>

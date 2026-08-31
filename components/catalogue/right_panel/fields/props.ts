import type { PropType } from "vue";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { BSIQuery } from "~/assets/shared/battlescribe/bs_types";

/**
 * A node carrying a query: constraints, conditions, repeats, local condition groups and
 * associations all have one, and the same field components edit all of them.
 *
 * Partial of a single interface, deliberately. Each of those node kinds declares `type`
 * differently, so intersecting their interfaces collapses that member and nothing satisfies
 * the result. BSIQuery is the one shape they genuinely share, and optional members say the
 * true thing: the field may be there, and the component checks.
 */
export type QueryNode = EditorBase & Partial<BSIQuery>;

export type FieldOption = string | number | { value: unknown; label?: string };

/** Reading a field named at runtime; the node has no index signature to do it through. */
export function fieldValue(item: EditorBase, field: string): unknown {
  return (item as unknown as Record<string, unknown>)[field];
}

/**
 * Shared prop definitions for the right panel.
 *
 * Every panel declared the same ten-line item/catalogue block; spreading these instead keeps
 * the shape in one place, so widening a type doesn't mean editing two dozen files.
 */
export const itemProp = {
  item: { type: Object as PropType<EditorBase>, required: true as const },
};

export const catalogueProp = {
  catalogue: { type: Object as PropType<Catalogue>, required: true as const },
};

/** Everything EditorFieldControl accepts; EditorField adds the label and tooltip. */
export const fieldControlProps = {
  ...itemProp,
  field: { type: String, required: true as const },
  /** text | number | checkbox | textarea | select, or any native input type. */
  type: { type: String, default: "text" },
  placeholder: { type: String, default: "" },
  options: { type: Array as PropType<FieldOption[]>, default: () => [] },
  /** Value treated as unset: writing it deletes the key rather than storing a redundant value. */
  default: { default: undefined },
  disabled: { type: Boolean, default: false },
};

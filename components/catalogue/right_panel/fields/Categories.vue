<template>
  <fieldset>
    <legend>
      <div class="inline">
        <Tag class="icon" />
      </div>
      Categories ({{ count }})
    </legend>
    <CatalogueEditV2Categories :item="item" />
  </fieldset>
</template>

<script lang="ts">
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import Tag from "../../edit_v2/Tag.vue";

/**
 * The count and the frame; the picker itself is edit_v2/Categories.
 *
 * This used to hold a second, older picker behind a `useNewCategoriesUI` setting -- a filter box,
 * a radio per category and its own link add/remove. That setting is gone and the v2 picker is the
 * only one, so the old branch and everything that served it (fields/Category.vue, the
 * `showOnlyEnabledCategories` setting) went with it. Both are in git if the picker ever needs
 * them back.
 */
export default {
  components: { Tag },
  props: {
    item: {
      type: Object as PropType<EditorBase>,
      required: true,
    },
    /** Unused here, but every call site passes it; declared so it does not land on the fieldset. */
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },
  computed: {
    count() {
      return this.item.categoryLinks?.length || 0;
    },
  },
};
</script>

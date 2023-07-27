<template>
  <div class="category" @contextmenu.stop="contextmenu.show">
    <div>
      <input
        name="primary"
        type="radio"
        :checked="hasCategory(category) == 2"
        @change="$emit('primaryChanged', category)"
      />
      Primary?
    </div>
    <div>
      <input
        :id="`category-${category.id}`"
        type="checkbox"
        :checked="hasCategory(category) != 0"
        @change="$emit('secondaryChanged', category)"
      />
      <label :for="`category-${category.id}`">
        {{ category.name }}<span class="gray"> [{{ category.catalogue.name }}]</span>
      </label>
    </div>
    <ContextMenu v-if="contextmenuopen" v-model="contextmenuopen" ref="contextmenu">
      <div @click="store.goto(category)">
        Goto {{ category.getName() }}
        <span class="gray"> &nbsp;({{ category.catalogue?.getName() }}) </span>
      </div>
    </ContextMenu>
  </div>
</template>
<script lang="ts">
import { Category, Link } from "~/assets/shared/battlescribe/bs_main";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import ContextMenu from "~/components/dialog/ContextMenu.vue";
import { useEditorStore } from "~/stores/editorStore";

export default defineComponent({
  props: {
    category: {
      required: true,
      type: Object as PropType<Category>,
    },
    item: {
      type: Object as PropType<Link & EditorBase>,
      required: true,
    },
  },
  setup() {
    return { store: useEditorStore() };
  },
  data() {
    return { contextmenuopen: false };
  },
  methods: {
    menu(ref: string) {
      return {
        show: (event: MouseEvent, e: any) => {
          this.contextmenuopen = true;
          this.$nextTick(() => {
            (this.$refs[ref] as any)?.show(event, e);
          });
        },
        close: (event: MouseEvent, e: any) => {
          (this.$refs[ref] as any)?.close(event, e);
          this.contextmenuopen = false;
        },
      };
    },
    hasCategory(cat: Category) {
      let link = this.item.categoryLinks?.find((elt) => elt.target?.id === cat.id);
      if (!link) {
        return 0;
      }
      if (link.primary) {
        return 2;
      }
      return 1;
    },
  },
  computed: {
    contextmenu() {
      return this.menu("contextmenu");
    },
  },
  components: { ContextMenu },
});
</script>
<style>
.category {
  display: grid;
  grid-template-columns: max-content max-content;
  grid-gap: 20px;
}
</style>

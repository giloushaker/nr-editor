<template>
  <div>
    <div>
      <template v-if="ownCategories?.length || ownPrimaryCategories?.length">
        <div
          v-for="category in ownPrimaryCategories"
          class="label hover-brighten"
          @contextmenu.stop="context($event, category)"
        >
          <span class="primary bold"> Primary </span>
          <span class="name">{{ category.getName() }} </span
          ><span class="cursor-pointer hover-darken px-5px rounded-8px" @click="removeCategory(category)">&times;</span>
        </div>
        <div v-for="category in ownCategories" class="label" @contextmenu.stop="context($event, category)">
          <span class="name">{{ category.getName() }} </span
          ><span class="cursor-pointer hover-darken px-5px rounded-8px" @click="removeCategory(category)">&times;</span>
        </div>
      </template>
      <template v-else>
        <span class="gray"> None </span>
      </template>
      <span class="py-1px rounded-8px bg-lime-400"
        ><span class="px-5px py-1px rounded-8px cursor-pointer hover-darken" @click="adding = true" v-if="!adding"
          >+</span
        >
      </span>
      <AutocompleteTags
        v-if="adding"
        @blur="adding = false"
        focus
        class="inline-block"
        lazy
        always
        :options="allCategories"
        placeholder="Search... (Right click = Primary)"
        :filterField="(o: Category) => o.getName()"
        @add="addCategory"
        @add-special="addCategoryAndMakePrimary"
        @always="createCategory"
      >
        <template #option="{ option }">
          <div class="flex align-items flex-row" style="white-space: nowrap">
            <template v-if="option?.name">
              <Tag class="icon" />
              <span
                >&nbsp;{{ option.name }}<span class="gray"> [{{ option.catalogue.name }}]</span></span
              >
            </template>
          </div>
        </template>
        <template #always="{ input }">
          <div class="flex align-items flex-row" style="white-space: nowrap" v-if="input.trim()">
            <span>Create: </span>&nbsp;<Tag class="icon" /><span>&nbsp;{{ input }}</span>
          </div>
        </template>
      </AutocompleteTags>
    </div>

    <div class="align-top mt-4px" v-if="targetCategories.length || targetPrimaryCategories.length">
      <img src="assets/bsicons/link.png" />
      From Target:
      <span
        v-for="category in targetPrimaryCategories"
        class="label"
        @contextmenu.stop="linked_context($event, category)"
      >
        <span class="primary bold"> Primary </span>
        <span class="name">{{ category.getName() }} </span>&nbsp;<span
          class="cursor-pointer hover-darken px-3px rounded-2px"
          @click="removeCategory(category)"
          >&times;</span
        >
      </span>
      <span v-for="category in targetCategories" class="label" @contextmenu.stop="linked_context($event, category)">
        <span class="name">{{ category.getName() }} </span>&nbsp;<span
          class="cursor-pointer hover-darken px-3px rounded-2px"
          @click="removeCategory(category)"
          >&times;</span
        >
      </span>
    </div>
    <ContextMenu
      v-if="contextmenuopen && selectedCategory && selectedCategoryParent"
      v-model="contextmenuopen"
      ref="contextmenu"
    >
      <div v-if="!selectedCategory.primary" @click="makePrimary(selectedCategory, selectedCategoryParent)">
        Make Primary: {{ selectedCategory.getName() }}
      </div>
      <div v-if="selectedCategory.primary" @click="makeSecondary(selectedCategory)">
        Make Secondary: {{ selectedCategory.getName() }}
      </div>
      <div @click="store.goto(selectedCategory)">
        Goto {{ selectedCategory.getName() }}
        <span class="gray"> &nbsp;({{ selectedCategory.catalogue?.getName() }}) </span>
      </div>
    </ContextMenu>
  </div>
</template>
<script lang="ts">
import Tag from "./Tag.vue";
import AutocompleteTags from "~/components/util/AutocompleteTags.vue";
import { Base, Category, CategoryLink, Link } from "~/assets/shared/battlescribe/bs_main";
import { setPrototype } from "~/assets/shared/battlescribe/bs_main_types";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import ContextMenu from "~/components/dialog/ContextMenu.vue";
import { getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import { useEditorStore } from "~/stores/editorStore";

export default defineComponent({
  components: { AutocompleteTags, Tag, ContextMenu },
  props: {
    item: {
      type: Object as PropType<EditorBase>,
      required: true,
    },
  },
  data() {
    return {
      input: "",
      adding: false,
      contextmenuopen: false,
      selectedCategory: null as (EditorBase & CategoryLink) | null,
      selectedCategoryParent: null as Base | null,
    };
  },
  setup() {
    return { store: useEditorStore() };
  },

  computed: {
    catalogue() {
      return this.item.catalogue;
    },
    targetCategories(): Array<CategoryLink & EditorBase> {
      return (this.item.target?.categoryLinks || []).filter((o) => !o.primary) as Array<CategoryLink & EditorBase>;
    },
    ownCategories(): Array<CategoryLink & EditorBase> {
      return (this.item.categoryLinks || []).filter((o) => !o.primary) as Array<CategoryLink & EditorBase>;
    },
    targetPrimaryCategories(): Array<CategoryLink & EditorBase> {
      return (this.item.target?.categoryLinks || []).filter((o) => o.primary) as Array<CategoryLink & EditorBase>;
    },
    ownPrimaryCategories(): Array<CategoryLink & EditorBase> {
      return (this.item.categoryLinks || []).filter((o) => o.primary) as Array<CategoryLink & EditorBase>;
    },
  },
  methods: {
    getNameExtra,
    makePrimary(category: CategoryLink, parent: Base) {
      parent.categoryLinks?.forEach((o) => (o.primary = false));
      category.primary = true;
    },
    makeSecondary(category: CategoryLink) {
      category.primary = false;
    },
    context(event: Event, category: CategoryLink & EditorBase) {
      this.contextmenuopen = true;
      this.selectedCategory = category;
      this.selectedCategoryParent = this.item;
      this.$nextTick(() => {
        (this.$refs.contextmenu as { show: (event: Event) => unknown })?.show(event);
      });
    },
    linked_context(event: Event, category: CategoryLink & EditorBase) {
      if (!this.item.target) {
        console.error("Cant open context menu for a category on the target: Couldn't find target");
        return;
      }
      this.contextmenuopen = true;
      this.selectedCategory = category;
      this.selectedCategoryParent = this.item.target;
      this.$nextTick(() => {
        (this.$refs.contextmenu as { show: (event: Event) => unknown })?.show(event);
      });
    },
    refreshCategories(item: Link & EditorBase, cat: Category | null, primary: boolean) {
      if (!item.categoryLinks) item.categoryLinks = [];
      const links = item.categoryLinks;
      if (primary) {
        links.forEach((o) => (o.primary = false));
      }
      if (cat) {
        const found = links.find((o) => o.targetId === cat?.id);
        if (found && primary) {
          found.primary = true;
        } else if (found) {
          this.removeLink(links, found);
        } else {
          this.addLink(links, cat, primary);
        }
      }
    },
    removeLink(links: Array<CategoryLink>, link: Link) {
      const idx = links.findIndex((o) => o === link);
      if (idx !== -1) {
        const [cl] = links.splice(idx, 1);
        this.catalogue.removeFromIndex(cl as CategoryLink & EditorBase);
        const targetLinks = (cl.target as Category & EditorBase).links as Base[];
        if (targetLinks) {
          const targetIdx = targetLinks?.findIndex((o) => o === cl);
          if (targetIdx !== -1) {
            targetLinks?.splice(targetIdx, 1);
          }
        }
      }
    },
    addLink(links: Link[], cat: Category, primary = false) {
      if (!cat.isCategory()) {
        throw Error("Invalid argument, target must be a category");
      }
      const cl = setPrototype(
        {
          targetId: cat.id,
          target: cat,
          id: this.item.catalogue.generateNonConflictingId(),
          primary: primary,
          catalogue: this.item.catalogue,
          name: cat.name,
        },
        "categoryLinks"
      );
      links.push(cl);
      this.catalogue.addToIndex(cl);
      const target = cat as Category & EditorBase;
      if (!target.links) {
        target.links = [];
      }
      target.links?.push(cl as CategoryLink & EditorBase);
      return cl;
    },
    allCategories() {
      const current = new Set<string>();
      for (const category of this.item.categoryLinks || []) {
        current.add(category.getId());
      }
      const result = [];
      for (const category of this.item.catalogue.iterateCategoryEntries()) {
        if (!current.has(category.getId())) {
          result.push(category);
        }
      }
      return result;
    },
    addCategory(category: Category) {
      if (!this.item.categoryLinks) this.item.categoryLinks = [];
      const links = this.item.categoryLinks;
      const found = links.find((o) => o.targetId === category.getId());
      if (found) {
        return found;
      }
      return this.addLink(links, category, false);
    },
    addCategoryAndMakePrimary(category: Category) {
      const cl = this.addCategory(category);
      this.makePrimary(cl, this.item);
    },
    removeCategory(category: Category) {
      if (!this.item.categoryLinks) this.item.categoryLinks = [];
      const links = this.item.categoryLinks;
      const found = links.find((o) => o.targetId === category.getId());
      if (found) {
        this.removeLink(links, found);
      }
    },
    createCategory(name: string) {},
  },
});
</script>
<style scoped>
.label {
  background-color: #80808080;
  display: inline-block;
  padding: 2px 0px 2px 4px;
  border-radius: 5px;
  margin: 2px;
}
</style>

<template>
  <div :class="{ 'dark': settings.isDarkTheme }">
    <div>
      <template v-if="ownCategories?.length || ownPrimaryCategories?.length">
        <div v-for="category in ownPrimaryCategories" class="label hover-brighten"
          @contextmenu.stop="context($event, category)">
          <span class="primary bold"> Primary </span>
          <span class="name">{{ category.getName() }} </span><span class="cursor-pointer hover-darken px-5px rounded-8px"
            @click="removeCategory(item, category)">&times;</span>
        </div>
        <div v-for="category in ownCategories" class="label" @contextmenu.stop="context($event, category)">
          <span class="name">{{ category.getName() }} </span><span class="cursor-pointer hover-darken px-5px rounded-8px"
            @click="removeCategory(item, category)">&times;</span>
        </div>
      </template>
      <template v-else>
        <span class="gray"> None </span>
      </template>
      <span class="py-1px rounded-8px bg-lime-400"><span class="px-5px py-1px rounded-8px cursor-pointer hover-darken"
          @click="adding = true" :style="{ color: settings.isDarkTheme ? 'black' : 'white' }" v-if="!adding">+</span>
      </span>
      <AutocompleteTags v-if="adding" v-model="input" @blur="adding = false" focus class="inline-block" lazy
        :always="Boolean(input.trim()) && !allCategories().find((o) => o.name === input)" :options="allCategories"
        :dark="settings.isDarkTheme" placeholder="Search... (Right click = Primary)"
        :filterField="(o: Category) => o.getName()" @add="addCategory" @add-special="addCategoryAndMakePrimary"
        @always="createCategory" @always-special="createPrimaryCategory">

        <template #option="{ option, selected }">
          <div class="flex align-items flex-row" style="white-space: nowrap">
            <template v-if="option?.name">
              <Tag class="icon" />
              <span>&nbsp;{{ option.name }}<span class="gray"> [{{ option.catalogue.name }}]</span></span>
            </template>
          </div>
        </template>
        <template #always="{ input }">
          <div class="flex align-items flex-row" style="white-space: nowrap">
            <span>Create: </span>&nbsp;
            <Tag class="icon" /><span>&nbsp;{{ input }}</span>
          </div>
        </template>
      </AutocompleteTags>
    </div>

    <div class="align-top mt-4px" v-if="targetCategories.length || targetPrimaryCategories.length">
      <img src="assets/bsicons/link.png" />
      From Target:
      <span v-for="category in targetPrimaryCategories" class="label"
        @contextmenu.stop="linked_context($event, category)">
        <span class="primary bold"> Primary </span>
        <span class="name">{{ category.getName() }} </span>&nbsp;<span
          class="cursor-pointer hover-darken px-3px rounded-2px"
          @click="removeCategory((item as EditorBase & Link).target, category)">&times;</span>
      </span>
      <span v-for="category in targetCategories" class="label" @contextmenu.stop="linked_context($event, category)">
        <span class="name">{{ category.getName() }} </span>&nbsp;<span
          class="cursor-pointer hover-darken px-3px rounded-2px"
          @click="removeCategory((item as EditorBase & Link), category)">&times;</span>
      </span>
    </div>
    <ContextMenu v-if="contextmenuopen && selectedCategory && selectedCategoryParent" v-model="contextmenuopen"
      ref="contextmenu">
      <div v-if="!selectedCategory.primary" @click="makePrimary(selectedCategory, selectedCategoryParent)">
        Make Primary: {{ selectedCategory.getName() }}
      </div>
      <div v-if="selectedCategory.primary" @click="makeSecondary(selectedCategory)">
        Make Secondary: {{ selectedCategory.getName() }}
      </div>
      <div @click="gotoCategory(selectedCategory)">
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
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import ContextMenu from "~/components/dialog/ContextMenu.vue";
import { getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import { useEditorStore } from "~/stores/editorStore";
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { useSettingsStore } from "~/stores/settingsState";

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
    return { store: useEditorStore(), settings: useSettingsStore() };
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
          this.removeLink(this.item, found);
        } else {
          this.addLink(this.item, cat, primary);
        }
      }
    },
    removeLink(parent: EditorBase, link: Link) {
      this.store.del_node(link)
    },
    addLink(parent: EditorBase, cat: Category, primary = false) {
      if (!cat.isCategory()) {
        throw Error("Invalid argument, target must be a category");
      }
      const added = this.store.add_node("categoryLinks", parent, {
        targetId: cat.id,
        id: this.item.catalogue.generateNonConflictingId(),
        primary: primary,
        name: cat.name,
      });
      return added;
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
      return this.addLink(this.item, category, false);
    },
    addCategoryAndMakePrimary(category: Category) {
      const cl = this.addCategory(category);
      this.makePrimary(cl, this.item);
    },
    removeCategory(parent: Base, category: Category) {
      const links = parent.categoryLinks || [];
      const found = links.find((o) => o.targetId === category.getId());
      if (found) {
        return this.removeLink(this.item, found);
      }
    },
    async createCategory(name: string, primary = false) {
      const parent = this.item.catalogue as Catalogue & EditorBase;
      const key = "categoryEntries";
      const obj = {
        ...this.store.get_initial_object(key, parent),
        name,
        id: generateBattlescribeId(),
      };
      await this.store.add(obj, key, parent);
      const added = this.item.catalogue.categoryEntries?.find((o) => o.name === name);
      if (added) {
        if (primary) {
          return this.addCategoryAndMakePrimary(added);
        } else {
          return this.addCategory(added);
        }
      }
    },
    async createPrimaryCategory(name: string) {
      await this.createCategory(name, true);
    },
    gotoCategory(category: EditorBase & CategoryLink) {
      const entry = this.catalogue.findOptionById(category.id);
      if (entry) {
        this.store.goto(entry as EditorBase);
      }
    },
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

.dark * .plus {
  color: white;
}
</style>

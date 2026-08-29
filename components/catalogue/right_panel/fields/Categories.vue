<template>
  <fieldset>
    <legend>
      <div class="inline">
        <Tag class="icon" />
      </div>
      Categories ({{ count }})
    </legend>
    <template v-if="settings.useNewCategoriesUI">
      <CatalogueEditV2Categories :item="item" />
    </template>
    <template v-else>
      <input class="section" type="text" v-model="filter" placeholder="Filter categories..." />
      <div class="section inline">
        <input type="checkbox" id="onlyEnabled" v-model="settings.showOnlyEnabledCategories" />
        <label for="onlyEnabled">Only show selected categories</label>
      </div>
      <div class="section categoryList">
        <div>
          <input name="primary" type="radio" :checked="noPrimary" @change="primaryChanged(null)" />
          No Primary
        </div>

        <Category v-for="cat of categories" :category="cat" :item="item" :key="cat.id" @primaryChanged="primaryChanged" @secondaryChanged="secondaryChanged" />

        <div v-for="lnk of badLinks" class="category" :key="lnk.id">
          <div>
            <input name="primary" type="radio" :checked="lnk.primary" @change="primaryChangedLink(lnk)" />
            Primary?
          </div>
          <div>
            <input :id="`bad${lnk.id}`" type="checkbox" :checked="true" @change="removeLink(item.categoryLinks!, lnk)" />
            <label :for="`bad${lnk.id}`">{{ lnk.name }}</label>
            <ErrorIcon class="ml-5px inline" :errors="[{ msg: `Couldn't find category with id: ${lnk.targetId}`, severity: 'error' }]" />
          </div>
        </div>
      </div>
    </template>
  </fieldset>
</template>

<script lang="ts">
import { Base, Category, CategoryLink, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { setPrototype } from "~/assets/shared/battlescribe/bs_main_types";
import { useSettingsStore } from "~/stores/settingsState";
import { useEditorStore } from "~/stores/editorStore";
import CategoryVue from "~/components/catalogue/right_panel/fields/Category.vue";
import Tag from "../../edit_v2/Tag.vue";

export default {
  components: { Category: CategoryVue, Tag },
  data() {
    return {
      filter: "",
      primaries: new Set<string>(),
      secondaries: new Set<string>(),
    };
  },
  setup() {
    return { settings: useSettingsStore(), store: useEditorStore() };
  },
  props: {
    item: {
      type: Object as PropType<EditorBase>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  methods: {
    /**
     * Marks the catalogue unsaved. These edits deliberately bypass store.set_field -- the id
     * has to move the node in the index, min/max are raw v-model, categories mutate a links
     * array -- and set_field is what otherwise reports the change, so without this the edit
     * lands but the save indicator never lights up. Was calling a `changed()` that no
     * component defined, so it threw.
     */
    changed() {
      this.store.changed(this.item as EditorBase);
    },
    hasCategory(cat: Category) {
      const link = this.item.categoryLinks?.find((elt) => elt.target?.id === cat.id);
      if (!link) {
        return 0;
      }
      if (link.primary) {
        return 2;
      }
      return 1;
    },
    primaryChanged(cat: Category | null) {
      this.refreshCategories(this.item, cat, true);
    },

    secondaryChanged(cat: Category) {
      this.refreshCategories(this.item, cat, false);
    },

    /**
     * A bad link has no target, so it cannot go through refreshCategories: that looks links up by
     * category id, never matches (targetId holds the missing category's id, not the link's), and
     * falls through to addLink -- which throws on isCategory(). Flip the link itself instead.
     * hasCategory() had the mirror problem and always reported 0, so the radio never showed as set.
     */
    primaryChangedLink(link: CategoryLink) {
      for (const o of this.item.categoryLinks || []) o.primary = false;
      link.primary = true;
      this.changed();
    },

    refreshCategories(item: EditorBase, cat: Category | null, primary: boolean) {
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
      this.changed();
    },
    removeLink(links: Array<CategoryLink>, link: Link) {
      const idx = links.findIndex((o) => o === link);
      if (idx !== -1) {
        const [cl] = links.splice(idx, 1);
        this.catalogue.removeFromIndex(cl as CategoryLink & EditorBase);
        const targetLinks = (cl.target as Category & EditorBase).refs as Base[];
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
          id: this.catalogue.generateNonConflictingId(),
          primary: primary,
          catalogue: this.catalogue,
          name: cat.name,
        },
        "categoryLinks"
      );
      links.push(cl);
      // addToIndex records the link's targetId, which is what makes it a ref of the
      // category -- there is no array to append to any more.
      this.catalogue.addToIndex(cl);
      return cl;
    },
    noPrimary() {
      const res = true;
      if (this.item.categoryLinks) {
        for (const cat of this.item.categoryLinks) {
          if (cat.primary) {
            return false;
          }
        }
      }
      return res;
    },
  },

  computed: {
    badLinks() {
      const result = [];
      const categories = new Set<String>();
      for (const category of this.catalogue.iterateCategoryEntries()) {
        categories.add(category.id);
      }
      for (const cl of this.item.categoryLinks || []) {
        if (!categories.has(cl.targetId)) {
          result.push(cl);
        }
      }
      return result;
    },
    count() {
      return this.item.categoryLinks?.length || 0;
    },
    categories() {
      const res: Category[] = [];

      for (const cat of this.catalogue.iterateCategoryEntries()) {
        if (this.settings.showOnlyEnabledCategories && this.hasCategory(cat) == 0) {
          continue;
        }
        if (cat.getName().toLowerCase().includes(this.filter.toLowerCase())) {
          res.push(cat);
        }
      }

      return res;
    },
  },
};
</script>

<style scoped lang="scss">
.categoryList {
  max-height: 200px;
  overflow: auto;
}
</style>

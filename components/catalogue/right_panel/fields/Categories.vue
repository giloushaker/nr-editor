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

        <Category
          v-for="cat of categories"
          :category="cat"
          :item="item"
          :key="cat.id"
          @primaryChanged="primaryChanged"
          @secondaryChanged="secondaryChanged"
        />

        <div v-for="lnk of badLinks" class="category" :key="lnk.id">
          <div>
            <input name="primary" type="radio" :checked="hasCategory(lnk) == 2" @change="primaryChanged(lnk)" />
            Primary?
          </div>
          <div>
            <input
              :id="`bad${lnk.id}`"
              type="checkbox"
              :checked="true"
              @change="removeLink(item.categoryLinks!, lnk)"
            />
            <label :for="`bad${lnk.id}`">{{ lnk.name }}</label>
            <ErrorIcon
              class="ml-5px inline"
              :errors="[{ msg: `Couldn't find category with id: ${lnk.targetId}`, severity: 'error' }]"
            />
          </div>
        </div>
      </div>
    </template>
  </fieldset>
</template>

<script lang="ts">
import { Base, Category, CategoryLink, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { setPrototype } from "~/assets/shared/battlescribe/bs_main_types";
import { useSettingsStore } from "~/stores/settingsState";
import CategoryVue from "~/components/catalogue/right_panel/fields/Category.vue";
import Tag from "../../edit_v2/Tag.vue";

export default {
  components: { Category: CategoryVue, Tag },
  emits: ["catalogueChanged"],
  data() {
    return {
      filter: "",
      primaries: new Set<string>(),
      secondaries: new Set<string>(),
    };
  },
  setup() {
    return { settings: useSettingsStore() };
  },
  props: {
    item: {
      type: Object as PropType<Link & EditorBase>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  methods: {
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
    primaryChanged(cat: Category | null) {
      this.refreshCategories(this.item, cat, true);
    },

    secondaryChanged(cat: Category) {
      this.refreshCategories(this.item, cat, false);
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
      this.changed();
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
          id: this.catalogue.generateNonConflictingId(),
          primary: primary,
          catalogue: this.catalogue,
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
    changed() {
      this.$emit("catalogueChanged");
    },
    noPrimary() {
      let res = true;
      if (this.item.categoryLinks) {
        for (let cat of this.item.categoryLinks) {
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
      let res: Category[] = [];

      for (let cat of this.catalogue.iterateCategoryEntries()) {
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

<template>
  <fieldset>
    <legend>Categories ({{ count }})</legend>
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

      <div v-for="cat of categories" class="category" :key="cat.id">
        <div>
          <input name="primary" type="radio" :checked="hasCategory(cat) == 2" @change="primaryChanged(cat)" />
          Primary?
        </div>
        <div>
          <input
            :id="`cat${cat.id}`"
            type="checkbox"
            :checked="hasCategory(cat) != 0"
            @change="secondaryChanged(cat)"
          />
          <label :for="`cat${cat.id}`">{{ cat.name }}</label>
        </div>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { Category, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { setPrototype } from "~/assets/shared/battlescribe/bs_main_types";
import { useSettingsStore } from "~/stores/settingsState";

export default {
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
      type: Object as PropType<Link>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
  },

  methods: {
    primaryChanged(cat: Category | null) {
      this.refreshCategories(this.item, cat, true);
    },

    secondaryChanged(cat: Category) {
      this.refreshCategories(this.item, cat, false);
    },

    refreshCategories(item: Link, cat: Category | null, primary: boolean) {
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
      console.log(links.map((o) => o.target.getName() + " " + o.primary + " " + o.id).join("\n"));
    },
    removeLink(links: Link[], link: Link) {
      const idx = links.findIndex((o) => o === link);
      if (idx !== -1) {
        const [cl] = links.splice(idx, 1);
        this.catalogue.removeFromIndex(cl);
        const targetLinks = (cl.target as EditorBase).links;
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
      const target = cat as EditorBase;
      if (!target.links) {
        target.links = [];
      }
      target.links?.push(cl);
      return cl;
    },
    changed() {
      this.$emit("catalogueChanged");
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
.category {
  display: grid;
  grid-template-columns: max-content max-content;
  grid-gap: 20px;
}

.categoryList {
  max-height: 200px;
  overflow: auto;
}
</style>

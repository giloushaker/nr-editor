<template>
  <fieldset>
    <legend>Categories</legend>
    <div></div>
    <input
      class="section"
      type="text"
      v-model="filter"
      placeholder="Filter categories..."
    />
    <div class="section categoryList">
      <div>
        <input
          name="primary"
          type="radio"
          :checked="noPrimary"
          @change="primaryChanged(null)"
        />
        No Primary
      </div>

      <div v-for="cat of categories" class="category">
        <div>
          <input
            name="primary"
            type="radio"
            :checked="hasCategory(cat) == 2"
            @change="primaryChanged(cat)"
          />
          Primary?
        </div>
        <div>
          <input
            type="checkbox"
            :checked="hasCategory(cat) != 0"
            @change="secondaryChange(cat)"
          />
          {{ cat.name }}
        </div>
      </div>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { Category, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  data() {
    return {
      filter: "",
    };
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
    primaryChanged(cat: Category | null) {},

    secondaryChanged(cat: Category) {},

    changed() {
      this.$emit("catalogueChanged");
    },

    hasCategory(cat: Category) {
      let link = this.item.categoryLinks?.find(
        (elt) => elt.target.id === cat.id
      );
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
    categories() {
      let res: Category[] = [];

      for (let cat of this.catalogue.iterateCategoryEntries()) {
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

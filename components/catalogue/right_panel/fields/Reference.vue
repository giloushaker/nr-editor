<template>
  <fieldset>
    <legend>Reference</legend>
    <table class="editorTable">
      <tr>
        <td>Publication:</td>
        <td>
          <UtilAutocomplete
            :options="publications"
            :filterField="(o: Publication) => o.getName()"
            valueField="id"
            v-model="item.publicationId"
            @change="changed"
          >
            <template #option="{ option }">
              <div class="flex align-items flex-row">
                <img class="mr-1 my-auto" :src="`./assets/bsicons/${option.editorTypeName}.png`" /><span class="inline">
                  {{ getName(option) }} <span class="grey">{{ getNameExtra(option) }}</span>
                </span>
              </div>
            </template>
          </UtilAutocomplete>
        </td>
      </tr>
      <tr>
        <td>Page:</td>
        <td>
          <input type="text" v-model="item.page" @change="changed" />
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { getName, getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { Base } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, Publication } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  emits: ["catalogueChanged"],
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    item: {
      type: Object as PropType<Base>,
      required: true,
    },
  },
  computed: {
    publications() {
      return sortByAscending([...this.catalogue.iteratePublications()], (o) => o?.name || "");
    },
  },
  methods: {
    getNameExtra,
    getName,
    changed() {
      this.$emit("catalogueChanged");
    },
  },
};
</script>

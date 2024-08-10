<template>
  <fieldset>
    <legend>Basics</legend>
    <table class="editorTable">
      <tr>
        <td>Unique ID:</td>
        <td class="flex gap-2px">
          <input type="text" v-model="id" @change="idchanged" class="flex flex-shrink" />
          <button class="btn !w-34px flex items-center mr-8px" @click="refresh">
            <span>
              <img class="h-20px w-20px icon" src="/assets/icons/back.png" title="Generate Id" />
            </span>
          </button>
        </td>
      </tr>
      <tr>
        <td>Name:</td>
        <td><input type="text" v-model="item.name" @change="namechanged" /></td>
      </tr>
      <template v-if="aliases">
        <tr>
          <td
            class="hastooltip"
            title="Additional Aliases for in-text reference matching, case insensitive.
one per line"
          >
            Aliases:
          </td>
          <td><InputStringArray v-model="item.alias" @change="aliaschanged" /></td>
        </tr>
        <tr>
          <td class="hastooltip" title="Disable indexing the name of this node for in-text references.">No Index</td>
          <td><input type="checkbox" v-model="item.noindex" @change="namechanged" /></td>
        </tr>
      </template>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { BSIOption, BSINamed, BSIAliasable } from "~/assets/shared/battlescribe/bs_types";
import InputStringArray from "./InputStringArray.vue";

export default {
  components: { InputStringArray },
  emits: ["catalogueChanged", "namechanged", "idchanged", "aliaschanged"],
  props: {
    item: {
      type: Object as PropType<BSIOption & BSINamed & Partial<BSIAliasable>>,
      required: true,
    },
    aliases: {
      type: Boolean,
      default: false,
    },
  },

  methods: {
    idchanged() {
      this.$emit("idchanged");
      this.$emit("catalogueChanged");
    },
    namechanged() {
      this.$emit("namechanged");
      this.$emit("catalogueChanged");
    },
    aliaschanged() {
      this.$emit("aliaschanged");
      this.$emit("catalogueChanged");
    },
    refresh() {
      this.id = generateBattlescribeId();
      this.idchanged();
    },
  },
  computed: {
    id: {
      get(): string {
        return this.item.id;
      },
      set(id: string) {
        const obj = this.item as EditorBase;
        const catalogue = obj.getCatalogue();
        catalogue.removeFromIndex(obj);
        obj.id = id;
        catalogue.addToIndex(obj);
      },
    },
  },
};
</script>
<style>
.btn {
  border: 1px solid var(--box-border, #aaa);
  background-color: var(--input-background);
  box-shadow: 2px 2px 5px -2px var(--box-border, #aaa);
}
</style>

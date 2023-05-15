<template>
  <fieldset>
    <legend>Link</legend>
    <table class="editorTable">
      <tr>
        <td>Link Type:</td>
        <td>
          <select @change="changed" :value="item.type">
            <option :value="'selectionEntry'">Selection Entry</option>
            <option :value="'entryGroup'">Entry Group</option>
          </select>
        </td>
      </tr>
      <tr>
        <td>Link To:</td>
        <td>
          <template v-if="item.target">
            <img
              v-if="item.type"
              :src="`/assets/bsicons/${getType(item)}.png`"
            />
            {{ item.target.name }}
          </template>
        </td>
      </tr>
      <tr>
        <td>Target ID:</td>
        <td>
          <input type="text" v-model="item.targetId" @change="updateLink" />
        </td>
      </tr>
      <tr>
        <td>Target:</td>
        <td>
          <UtilAutocomplete
            v-model="item.targetId"
            :placeholder="`Search Target...`"
            :options="availableTargets"
            valueField="id"
            filterField="name"
            @change="updateLink"
          >
            <template #option="opt">
              <div>
                <img
                  class="mr-1 align-middle"
                  :src="`/assets/bsicons/${opt.option.editorTypeName}.png`"
                />
                {{ opt.option.name }}
              </div>
            </template>
          </UtilAutocomplete>
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { ItemTypes } from "~/assets/shared/battlescribe/bs_editor";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { Base, Link } from "~/assets/shared/battlescribe/bs_main";
import {
  Catalogue,
  EditorBase,
} from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorState";

export default {
  setup() {
    return { store: useEditorStore() };
  },
  emits: ["catalogueChanged"],

  data() {
    return {
      filter: "",
      val: null as any,
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
    changed() {
      this.$emit("catalogueChanged");
    },

    getType(item: Link): "selectionEntry" | "selectionEntryGroup" {
      if (item.type === "selectionEntry") {
        return "selectionEntry";
      }
      return "selectionEntryGroup";
    },

    updateLink() {
      this.catalogue.updateLink(this.item as Link & EditorBase);
      this.changed();
    },

    itemName(elt: Base) {
      return elt.name;
    },

    itemValue(elt: Base) {
      return elt.name;
    },

    targetIsValid(target: ItemTypes) {
      return target.editorTypeName == this.item.type;
    },
  },

  computed: {
    availableTargets() {
      let all = this.catalogue.findOptionsByName("").filter((o) => {
        if (this.targetIsValid(o as ItemTypes) == false) {
          return false;
        }

        if (o.isLink()) return false;
        if (!(o as any).parent?.isCatalogue()) return false;
        return o.isEntry() || o.isGroup();
      });
      return sortByAscending(all, (o) => o.name);
    },
  },
};
</script>

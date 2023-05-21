<template>
  <fieldset>
    <legend>Link</legend>
    <table class="editorTable">
      <tr v-if="item.type !== undefined">
        <td>Link Type:</td>
        <td>
          <select @change="changed" v-model="itemType">
            <option disabled :value="''">Link</option>
            <option v-if="allowEntries" :value="'selectionEntry'">Selection Entry</option>
            <option v-if="allowGroups" :value="'selectionEntryGroup'"> Selection Entry Group </option>
          </select>
        </td>
      </tr>
      <tr>
        <td>Link To:</td>
        <td>
          <template v-if="item.target">
            <img v-if="item.type" :src="`/assets/bsicons/${getType(item)}.png`" />
            {{ item.target.name }}
          </template>
          <template v-else> <img src="/assets/icons/error_exclamation.png" /> No target selected </template>
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
                <img class="mr-1 align-middle" :src="`/assets/bsicons/${opt.option.editorTypeName}.png`" />
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
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
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
      availableTargets: [] as Array<Base & EditorBase>,
      itemType: "selectionEntry" as string | undefined,
    };
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

  created() {
    this.updateTargets();
    this.itemType = this.item.type;
  },

  computed: {
    allowEntries() {
      return true;
    },

    allowGroups() {
      return true;
    },
  },

  methods: {
    updateTargets() {
      let all = this.catalogue.findOptionsByName("").filter((o) => {
        if (this.targetIsValid(o as ItemTypes) == false) {
          return false;
        }

        if (o.isLink()) return false;
        if (!(o as any).parent?.isCatalogue()) return false;
        return o.isEntry() || o.isGroup() || o.isCategory();
      });
      this.availableTargets = sortByAscending(all, (o) => o.name) as Array<Base & EditorBase>;
    },

    typeChanged() {
      this.updateTargets();
      this.changed();
    },

    updateLink() {
      this.catalogue.updateLink(this.item);
      this.itemType = this.item.type;
    },

    changed() {
      this.$emit("catalogueChanged");
    },

    getType(item: Link): "selectionEntry" | "selectionEntryGroup" | "category" {
      if (!item.target) {
        return "selectionEntry";
      }

      if ((item.target as EditorBase).editorTypeName === "selectionEntry") {
        return "selectionEntry";
      }
      if ((item.target as EditorBase).editorTypeName === "selectionEntryGroup") {
        return "selectionEntryGroup";
      }
      return "category";
    },

    itemName(elt: Base) {
      return elt.name;
    },

    itemValue(elt: Base) {
      return elt.name;
    },

    targetIsValid(target: ItemTypes) {
      if (this.itemType == undefined) {
        return target.editorTypeName == "category";
      }
      return target.editorTypeName == this.itemType;
    },
  },

  watch: {
    item() {
      this.updateTargets();
    },

    itemType() {
      this.updateTargets();
    },
  },
};
</script>

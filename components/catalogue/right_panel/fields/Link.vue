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
              :src="`/assets/bsicons/${store.icons[getType(item)]}`"
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
          <select></select>
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorState";

export default {
  setup() {
    return { store: useEditorStore() };
  },
  emits: ["catalogueChanged"],
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

    getType(item: Link): "selectionEntries" | "selectionEntryGroups" {
      if (item.type === "selectionEntry") {
        return "selectionEntries";
      }
      return "selectionEntryGroups";
    },

    updateLink() {
      this.catalogue.resolveAllLinks(this.catalogue.imports);
      console.log(this.item.target);
      this.changed();
    },
  },
};
</script>

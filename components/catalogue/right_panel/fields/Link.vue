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
        <td></td>
        <td>
          <UtilAutocomplete
            :placeholder="`Search Target...`"
            v-model="filter"
            ref="autocomplete"
            :min="0"
          >
            <template #default="{ editing }">
              <div
                v-for="opt in availableTargets(filter)"
                v-if="editing"
                :value="opt"
                @click="targetSelected(opt)"
              >
                <img
                  class="mr-1 align-middle"
                  :src="`/assets/bsicons/${opt.editorTypeName}.png`"
                />
                {{ opt.getName() }}
              </div>
            </template>
          </UtilAutocomplete>
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { Base, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
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
  watch: {
    filter(v) {},

    item() {
      this.filter = "";
      (this.$refs.autocomplete as any)?.reset();
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
      this.catalogue.updateLink(this.item);
      this.changed();
    },

    targetSelected(elt: Base) {
      this.filter = "";
      (this.$refs.autocomplete as any)?.reset();
      this.item.target = elt;
      this.item.targetId = elt.id;
    },

    itemName(elt: Base) {
      return elt.name;
    },

    itemValue(elt: Base) {
      return elt.name;
    },

    availableTargets(filter: string) {
      let all = this.catalogue.findOptionsByName(filter || "").filter((o) => {
        if (o.isLink()) return false;
        if (!(o as any).parent?.isCatalogue()) return false;
        return o.isEntry() || o.isGroup();
      });
      return sortByAscending(all, (o) => o.name);
    },
  },

  computed: {},
};
</script>

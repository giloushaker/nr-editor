<template>
  <fieldset>
    <legend>Link</legend>
    <table class="editorTable">
      <tr v-if="type == 'entry'">
        <td>Link Type:</td>
        <td>
          <select @change="changed" v-model="item.type">
            <option v-if="allowEntries" :value="'selectionEntry'">Selection Entry</option>
            <option v-if="allowGroups" :value="'selectionEntryGroup'"> Selection Entry Group </option>
          </select>
        </td>
      </tr>
      <tr v-if="type == 'info'">
        <td>Link Type:</td>
        <td>
          <select @change="changed" v-model="item.type">
            <option :value="'profile'">Profile</option>
            <option :value="'rule'"> Rule </option>
            <option :value="'infoGroup'"> Info Group </option>
          </select>
        </td>
      </tr>
      <tr>
        <td>Link To:</td>
        <td>
          <template v-if="item.target">
            <img class="linkIcon" v-if="item.type" :src="`./assets/bsicons/${getType(item)}.png`" />
            {{ item.target.name }}
          </template>
          <template v-else>
            <img class="errIcon" src="/assets/icons/error_exclamation.png" /> No target selected
          </template>
        </td>
      </tr>
      <tr>
        <td>Target ID:</td>
        <td>
          <input type="text" v-model="item.targetId" @change="targetIdChanged" />
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
            @change="targetIdChanged"
          >
            <template #option="opt">
              <div>
                <img class="mr-1 align-middle" :src="`./assets/bsicons/${opt.option.editorTypeName}.png`" />
                {{ opt.option.name }}
              </div>
            </template>
          </UtilAutocomplete>
        </td>
      </tr>
      <tr v-if="type === 'catalogue'">
        <td></td>
        <td
          ><input
            @change="changedImportRootEntries"
            id="importRoot"
            type="checkbox"
            v-model="item.importRootEntries"
          /><label for="importRoot">Import Root Entries</label></td
        >
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { ItemTypes } from "~/assets/shared/battlescribe/bs_editor";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { Base, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, CatalogueLink, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";

export default {
  setup() {
    return { store: useEditorStore() };
  },
  emits: ["catalogueChanged"],

  data() {
    return {
      filter: "",
      val: null as any,
      availableTargets: [] as Array<{ name: string; id: string }>,
    };
  },

  props: {
    item: {
      type: Object as PropType<Link & EditorBase & CatalogueLink>,
      required: true,
    },
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
  },

  created() {
    this.updateTargets();
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
      if (this.type === "catalogue") {
        const id = this.catalogue.gameSystemId || this.catalogue.id;
        const values = Object.values(this.store.get_system(id).catalogueFiles);
        const catalogues = values.map((elt) => {
          return { id: elt.catalogue.id, name: elt.catalogue.name, editorTypeName: "catalogueLink" };
        });
        this.availableTargets = catalogues;
        return;
      }

      const all = this.catalogue.findOptionsByText("").filter((o) => {
        if (this.targetIsValid(o as ItemTypes) == false) {
          return false;
        }

        if (o.isLink()) return false;
        if (!(o as any).parent?.isCatalogue()) return false;
        return true;
      });
      this.availableTargets = sortByAscending(all, (o) => o.name) as Array<Base & EditorBase>;
    },

    typeChanged() {
      this.updateTargets();
      this.changed();
    },

    targetIdChanged() {
      this.updateLink();
      this.changed();
    },

    async updateLink() {
      if (this.type === "catalogue" && this.item.targetId) {
        const sysId = this.catalogue.gameSystemId || this.catalogue.id;
        await this.catalogue.reload(this.store.get_system(sysId));
        this.item.name = this.item.target.name || "Unknown";
      } else {
        this.catalogue.updateLink(this.item);
      }
    },
    changedImportRootEntries() {
      this.updateLink();
      this.changed();
    },
    changed() {
      this.$emit("catalogueChanged");
    },

    getType(item: Link): string {
      if (!item.target) {
        return "bullet";
      }

      return (item.target as EditorBase).editorTypeName;
    },

    itemName(elt: Base) {
      return elt.name;
    },

    itemValue(elt: Base) {
      return elt.name;
    },

    targetIsValid(target: ItemTypes) {
      if (this.item.type == undefined) {
        return target.editorTypeName == "category";
      }
      return target.editorTypeName == this.item.type;
    },
  },

  watch: {
    item() {
      this.updateTargets();
    },

    "item.type"() {
      this.updateTargets();
    },
  },
};
</script>

<style scoped>
.linkIcon {
  vertical-align: middle;
}

.errIcon {
  vertical-align: -2px;
}
</style>

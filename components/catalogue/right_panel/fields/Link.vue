<template>
  <fieldset>
    <legend> <img src="assets/bsicons/link.png" /> Link</legend>
    <table class="editorTable">
      <tr v-if="type == 'entry'">
        <td>Link Type:</td>
        <td>
          <select @change="typeChanged" v-model="item.type">
            <option v-if="allowEntries" value="selectionEntry">Selection Entry</option>
            <option v-if="allowGroups" value="selectionEntryGroup"> Selection Entry Group </option>
          </select>
        </td>
      </tr>
      <tr v-if="type == 'info'">
        <td>Link Type:</td>
        <td>
          <select @change="typeChanged" v-model="item.type">
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
            <img class="linkIcon" v-if="item.type" :src="`assets/bsicons/${getType(item)}.png`" />
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
              <div style="white-space: nowrap">
                <img class="mr-1 align-middle" :src="`assets/bsicons/${opt.option.editorTypeName}.png`" />
                {{ opt.option.name }}
                <span class="gray">{{ getNameExtra(opt.option, false) }}</span>
                <span class="shared" v-if="opt.option.shared"> (shared)</span>
                <span class="catalogueName" v-if="showCatalogue(opt.option)"> [{{ opt.option.catalogue.name }}]</span>
              </div>
            </template>
          </UtilAutocomplete>
        </td>
      </tr>
      <tr v-if="type === 'catalogue'">
        <td></td>
        <td>
          <input @change="changedImportRootEntries" id="importRoot" type="checkbox" v-model="item.importRootEntries" />
          <label for="importRoot">Import Root Entries</label>
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { ItemTypes, getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import { sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";
import { Base, Link } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { EditorSearchItem } from "~/assets/ts/catalogue/catalogue_helpers";
import { useEditorStore } from "~/stores/editorStore";

export default {
  setup() {
    return { store: useEditorStore() };
  },

  emits: ["catalogueChanged", "targetChanged"],

  data() {
    return {
      filter: "",
      val: null as any,
    };
  },

  props: {
    item: {
      type: Object as PropType<EditorBase & Link>,
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

  computed: {
    allowEntries() {
      return true;
    },

    allowGroups() {
      if (this.item.parent?.isCatalogue() && this.item.parentKey === "entryLinks") {
        return false;
      }
      return true;
    },
  },
  methods: {
    getNameExtra,
    availableTargets() {
      if (this.type === "catalogue") {
        const id = this.catalogue.gameSystemId || this.catalogue.id;
        const values = Object.values(this.store.get_system(id).catalogueFiles);
        const catalogues = values
          .map((elt) => {
            return { id: elt.catalogue.id, name: elt.catalogue.name, editorTypeName: "catalogueLink" };
          })
          .filter((o) => o.id !== this.catalogue.id);
        return catalogues;
      }
      const all = [];
      for (const entry of this.catalogue.iterateAllImported()) {
        if (!this.targetIsValid(entry as ItemTypes)) continue;
        if (entry.isLink()) continue;
        all.push(entry);
      }
      return sortByAscending(all, (o) => o.name) as Array<Base & EditorBase>;
    },
    typeChanged() {},

    targetIdChanged() {
      this.updateLink();
      this.changed();
    },

    async updateLink() {
      if (this.type === "catalogue" && this.item.targetId) {
        const oldTarget = this.item.target as (Catalogue & EditorBase) | undefined;
        if (oldTarget) {
          this.catalogue.removeRef(this.catalogue as Base as EditorBase, oldTarget);
        }
        const sysId = this.catalogue.gameSystemId || this.catalogue.id;
        await this.catalogue.reload(this.store.get_system(sysId));
        const target = this.item.target as (Catalogue & EditorBase) | undefined;
        if (target) {
          this.catalogue.addRef(this.catalogue as Base as EditorBase, target);
          this.item.name = target.name;
          this.item.type = target.editorTypeName;
        } else {
          this.item.name = "Unknown";
        }
      } else {
        this.catalogue.updateLink(this.item);
        const target = this.item.target as EditorBase | undefined;
        this.item.name = target?.name || "Unknown";
        this.item.type = (target?.editorTypeName || this.item.type) as any;
      }
      this.$emit("targetChanged");
    },
    changedImportRootEntries() {
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
      if (this.item.type == undefined || this.item.type === "category" || this.item.type === "categoryEntry") {
        return target.editorTypeName == "categoryEntry";
      }
      return target.editorTypeName == this.item.type;
    },

    showCatalogue(opt: EditorSearchItem): boolean {
      if (!opt.catalogue) {
        return false;
      }
      if (opt.catalogue === this.item.catalogue?.getName()) {
        return false;
      }
      return true;
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.linkIcon {
  vertical-align: middle;
}

.errIcon {
  vertical-align: -2px;
}

.catalogueName {
  color: rgb(144, 152, 197);
  font-style: italic;
}

.shared {
  color: $gray;
  font-style: italic;
}
</style>

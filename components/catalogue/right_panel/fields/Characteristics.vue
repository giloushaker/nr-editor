<template>
  <fieldset>
    <legend>Characteristics</legend>
    <table class="editorTable">
      <tr>
        <td>Profile Type: </td>

        <td>
          <UtilAutocomplete
            :options="profileTypes"
            :filterField="(o) => o.getName()"
            valueField="id"
            v-model="item.typeId"
            @change="changed"
          >
            <template #option="{ option }">
              <div class="flex align-items flex-row" style="white-space: nowrap">
                <img class="mr-1 my-auto" :src="`assets/bsicons/${option.editorTypeName}.png`" /><span class="inline">
                  {{ getName(option) }} <span class="grey">{{ getNameExtra(option) }}</span>
                </span>
              </div>
            </template>
          </UtilAutocomplete>
        </td>
      </tr>
    </table>
    <table class="editorTable">
      <tr v-for="char of charactacteristics">
        <td>{{ char.name }}: </td>
        <td><UtilEditableDiv v-model="char.$text" @change="changed" /></td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { getName, getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import { Link, Profile, ProfileType } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
export default {
  emits: ["catalogueChanged"],
  props: {
    catalogue: {
      type: Object as PropType<Catalogue>,
      required: true,
    },
    item: {
      type: Object as PropType<Profile>,
      required: true,
    },
  },
  methods: {
    getName,
    getNameExtra,
    changedType() {
      this.item.getCatalogue().refreshErrors(this.item as EditorBase & (Profile | Link<Profile>));
      this.$emit("catalogueChanged");
    },
    changed() {
      this.$emit("catalogueChanged");
    },
  },
  computed: {
    profileTypes() {
      return [...this.catalogue.iterateProfileTypes()];
    },

    charactacteristics() {
      const existing = {} as Record<string, any>;
      for (const c of this.item.characteristics || []) {
        existing[c.name] = c.$text;
      }
      if (!this.item.typeId) return [];
      const type = this.catalogue.findOptionById(this.item.typeId) as ProfileType;
      if (!this.item.isLink()) {
        this.item.typeName = type?.name;
      }

      const result = type?.characteristicTypes?.map((elt) => ({
        name: elt.name,
        typeId: elt.id,
        $text: existing[elt.name] || "",
      }));
      this.item.characteristics = result;
      return result;
    },
  },
};
</script>

<style scoped></style>

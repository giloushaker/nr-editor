<template>
  <fieldset>
    <legend>Characteristics<span class="gray" v-if="link"> (from target)</span></legend>
    <table class="editorTable">
      <tr>
        <td>Profile Type: </td>

        <td>
          <UtilAutocomplete
            :options="profileTypes"
            :filterField="(o: any) => o.getName()"
            valueField="id"
            v-model="item.typeId"
            @change="changedType"
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
      <tr v-for="char of characteristics">
        <td>{{ char.name }}: </td>
        <td
          ><UtilEditableDiv
            v-model="char.$text"
            @change="changed"
            :beforePaste="settings.autoFormatCharacteristics ? fixEndlines : undefined"
        /></td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { PropType } from "vue";
import { getName, getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import { Link, Profile, ProfileType } from "~/assets/shared/battlescribe/bs_main";
import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { useEditorStore } from "~/stores/editorStore";
import { useSettingsStore } from "~/stores/settingsState";

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
    link: {
      type: Boolean,
    },
  },
  setup() {
    return { settings: useSettingsStore(), store: useEditorStore() };
  },
  methods: {
    getName,
    getNameExtra,
    changedType(newType: ProfileType & EditorBase, oldOption: ProfileType & EditorBase): void {
      this.item.getCatalogue().refreshErrors(this.item as EditorBase & (Profile | Link<Profile>));

      if (oldOption) {
        this.catalogue.removeRef(this.item as Profile & EditorBase, oldOption);
      }
      if (newType) {
        this.catalogue.addRef(this.item as Profile & EditorBase, newType);
      }
      this.item.characteristics = this.characteristics;
      this.$emit("catalogueChanged");
    },

    changed(): void {
      const characteristics = this.characteristics;
      this.store.edit_node(this.item as Profile & EditorBase, { characteristics });
      this.$emit("catalogueChanged");
    },

    fixEndlines(updatedDescription: string): string {
      console.log("Fixing");
      updatedDescription = updatedDescription.replace(/([^.:])\n/g, "$1 ");

      updatedDescription = updatedDescription.replace(/([.:]\n)/g, "$1\n");

      // Add newline before dashes not preceded by newline
      updatedDescription = updatedDescription.replace(/([^\n])•(?=[^\n])/g, "$1\n• ");

      // Ensure there are no more than two consecutive newline characters
      updatedDescription = updatedDescription.replace(/\n\n\n*/g, "\n\n");

      return updatedDescription.replace(/ +/g, " ");
    },
  },

  computed: {
    profileTypes() {
      return [...this.catalogue.iterateProfileTypes()];
    },

    characteristics() {
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
      return result;
    },
  },
};
</script>

<style scoped></style>

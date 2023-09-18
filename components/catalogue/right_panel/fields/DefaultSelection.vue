<template>
  <fieldset>
    <legend>Selection Entry Group</legend>
    <table class="editorTable">
      <tr>
        <td>Default Selection:</td>
        <td>
          <UtilAutocomplete
            v-if="children.length"
            v-model="item.defaultSelectionEntryId"
            :placeholder="`Search Children...`"
            :options="children"
            valueField="id"
            filterField="name"
            @change="changed"
          >
            <template #option="opt">
              <div style="white-space: nowrap">
                <template v-if="opt.option.indent >= 2 && !opt.selected"
                  ><span v-for="n of opt.option.indent - 1">&nbsp;&nbsp;&nbsp;</span></template
                >
                <img class="mr-1 align-middle" :src="`./assets/bsicons/${opt.option.editorTypeName}.png`" />
                {{ opt.option.name }}
                <span class="gray">{{ getNameExtra(opt.option, false) }}</span>
              </div>
            </template>
          </UtilAutocomplete>

          <span v-else class="merror">This group does not have any child Selection Entries</span>
        </td>
      </tr>
    </table>
  </fieldset>
</template>

<script lang="ts">
import { getNameExtra } from "~/assets/shared/battlescribe/bs_editor";
import { Group } from "~/assets/shared/battlescribe/bs_main";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<Group>,
      required: true,
    },
  },

  methods: {
    getNameExtra,
    changed() {
      this.$emit("catalogueChanged");
    },
  },

  computed: {
    children() {
      let res: { name: string; id: undefined | null; editorTypeName: string }[] = [
        {
          name: "None",
          id: undefined,
          editorTypeName: "bullet",
        },
      ];

      for (let entry of this.item.entriesIterator()) {
        if (!entry.isGroup()) {
          res.push(entry as any);
        }
      }
      return res;
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";

.merror {
  color: $red;
  font-style: italic;
}
</style>

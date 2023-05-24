<template>
  <fieldset>
    <legend>Profil Type</legend>
    <h3>Characteristic Types</h3>
    <div>
      <select size="2" v-model="selectedType">
        <option :value="t" v-for="t of item.characteristicTypes">
          {{ t.name }}
        </option>
      </select>
      <div class="section add">
        <button class="bouton" @click="add"> <img src="assets/icons/iconeplus.png" /> Add </button>
        <button class="bouton" @click="del"> <img src="assets/icons/trash.png" /> Delete </button>
      </div>

      <template v-if="selectedType">
        <h3 class="section">Selected Characteristic Type</h3>
        <table class="editorTable">
          <tr>
            <td>Unique Id:</td>
            <td>
              <input type="text" v-model="selectedType.id" @change="changed" />
            </td>
          </tr>
          <tr>
            <td>Name:</td>
            <td>
              <input type="text" v-model="selectedType.name" @change="changed" />
            </td>
          </tr>
        </table>
      </template>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";
import { BSICharacteristicType, BSIProfileType } from "~/assets/shared/battlescribe/bs_types";
import { PropType } from "vue";
export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIProfileType>,
      required: true,
    },
  },
  data() {
    return {
      selectedType: null as BSICharacteristicType | null,
    };
  },
  methods: {
    add() {
      if (!this.item.characteristicTypes) {
        this.item.characteristicTypes = [];
      }
      this.item.characteristicTypes.push({
        id: generateBattlescribeId(),
        name: "New Characteristic Type",
      });
      this.changed();
    },

    del() {
      if (this.selectedType) {
        if (this.item.characteristicTypes) {
          const ind = this.item.characteristicTypes.indexOf(this.selectedType);
          if (ind != -1) {
            this.item.characteristicTypes.splice(ind, 1);
            this.selectedType = this.item.characteristicTypes[0];
          }
        }
      }
    },

    changed() {
      this.$emit("catalogueChanged");
    },

    init() {
      if (this.item.characteristicTypes?.length) {
        this.selectedType = this.item.characteristicTypes[0];
      }
    },
  },

  created() {
    this.init();
  },

  watch: {
    item() {
      this.init();
    },
  },
};
</script>

<style scoped lang="scss">
select {
  width: 100%;
  height: 300px;
}

h3 {
  font-size: 16px;
}

.add {
  display: grid;
  grid-gap: 10px;
  grid-auto-flow: column;
  grid-template-columns: 1fr min-content;
  justify-items: end;
}
</style>

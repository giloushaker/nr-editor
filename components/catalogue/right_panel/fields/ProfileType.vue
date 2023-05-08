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
        <button class="bouton" @click="add">
          <img src="/assets/icons/iconeplus.png" /> Add
        </button>
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
              <input
                type="text"
                v-model="selectedType.name"
                @change="changed"
              />
            </td>
          </tr>
        </table>
      </template>
    </div>
  </fieldset>
</template>

<script lang="ts">
import { ObjectId } from "bson";
import {
  BSICharacteristicType,
  BSIProfileType,
} from "~/assets/shared/battlescribe/bs_types";

export default {
  emits: ["catalogueChanged"],
  props: {
    item: {
      type: Object as PropType<BSIProfileType>,
      required: true,
    },
  },

  methods: {
    add() {
      this.item.characteristicTypes.push({
        id: new ObjectId().toString(),
        name: "New Characteristic Type",
      });
      this.changed();
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

  data() {
    return {
      selectedType: null as BSICharacteristicType | null,
    };
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
  text-align: right;
}
</style>

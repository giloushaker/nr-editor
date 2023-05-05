<template>
  <div class="box">
    <h3>My Catalogues</h3>
    <div class="boutons">
      <button class="bouton">Import Catalogue</button>
      <UploadJson @uploaded="filesUploaded" />
    </div>
    <div class="section">
      <SplitView :split="true" :double="true" :showRight="selectedItem != null">
        <template #middle>
          <IconContainer :items="items" @itemClicked="itemClicked" />
        </template>
        <template #right v-if="selectedItem">
          <div><MyCataloguesDetail :catalogue="selectedItem" /></div>
        </template>
      </SplitView>
    </div>
  </div>
</template>

<script lang="ts">
import CollapsibleBox from "~/shared_components/CollapsibleBox.vue";
import { NamedItem } from "@/components/IconContainer.vue";

export default defineComponent({
  components: { CollapsibleBox },
  data() {
    return {
      items: [
        {
          name: "Orcs and Goblins",
        },
        {
          name: "Warriors of Chaos",
        },
        {
          name: "Highborn Elves",
        },
        {
          name: "Vampire Counts",
        },
      ],

      selectedItem: null as NamedItem | null,
    };
  },

  methods: {
    itemClicked(item: NamedItem) {
      this.selectedItem = item;
    },
    filesUploaded(files: any[]) {},
  },
});
</script>

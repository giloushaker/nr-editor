<template>
  <PopupDialog
    v-model="isOpen"
    v-if="isOpen"
    :text="promptCancel"
    @button="doResolve(true)"
    @close="doResolve(false)"
    :button="promptAccept"
    nocloseonclickoutside
  >
    <div v-html="promptHtml"></div>

    <div v-if="promptId">
      <br />
      <input type="checkbox" :id="promptId" /><label :for="promptId">Dont show this again</label>
    </div>
  </PopupDialog>
</template>
<script setup lang="ts">
import { isObject } from "~/assets/shared/battlescribe/bs_helpers";
import { usePromptStore } from "~/stores/promptStore";
const store = usePromptStore();
const isOpen = ref(false);
const promptHtml = ref("");
const promptAccept = ref("Yes");
const promptCancel = ref("Cancel");
const promptId = ref<string | null>(null);
let promptResolve = null as ((response: number) => void) | null;

globalThis.customPrompt = (data: any) => {
  if (promptResolve !== null) {
    throw new Error("Cannot create a Prompt when one is already active");
  }
  const promise = new Promise((resolve) => {
    if (typeof data === "string") {
      promptHtml.value = data;
    } else if (isObject(data)) {
      if (data.id && store.get(data.id)) {
        resolve(false);
        return;
      }
      promptHtml.value = data.html;
      promptCancel.value = data.cancel ?? "Cancel";
      promptAccept.value = data.accept ?? "Yes";
      promptId.value = data.id ?? null;
    }
    promptResolve = resolve;
  });
  isOpen.value = true;
  return promise;
};
function doResolve(result: any) {
  if (promptResolve) {
    promptResolve(result);
    promptResolve = null;
  }
  isOpen.value = false;
}
</script>

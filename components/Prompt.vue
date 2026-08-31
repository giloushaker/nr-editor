<template>
  <!-- Own buttons instead of PopupDialog's, so dismissing (veil/Esc) resolves null and stays
       distinguishable from the cancel button: "not this" is not the same answer as "neither". -->
  <PopupDialog v-model="isOpen" v-if="isOpen" noclose @close="doResolve(null)" width="420px">
    <div class="prompt-body" v-html="promptHtml"></div>

    <label v-if="promptId" class="prompt-dontshow">
      <input type="checkbox" v-model="promptDontShowAgain" /> Don't show this again
    </label>

    <template #boutons>
      <button class="bouton close" :class="{ danger: promptDanger }" @click="doResolve(true)">{{ promptAccept }}</button>
      <button class="bouton close" @click="doResolve(false)">{{ promptCancel }}</button>
    </template>
  </PopupDialog>
</template>

<style scoped lang="scss">
@use "@/shared_components/css/vars.scss" as *;

/* Destructive confirm: the risky choice reads as such. */
.bouton.danger {
  border-color: $red;
  color: $red;
}

.prompt-body {
  padding: 14px 14px 10px;
  line-height: 1.5;
}

.prompt-dontshow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px 8px;
  font-size: 13px;
  opacity: 0.75;
  cursor: pointer;
  width: fit-content;
}
</style>

<!-- Unscoped on purpose: the accept/cancel buttons live inside PopupDialog's own template, out of
     scoped reach. A dialog button should never wrap its label mid-word, in any dialog. -->
<style>
.close-wrap .bouton {
  white-space: nowrap;
}
</style>
<script setup lang="ts">
import { isObject } from "~/assets/shared/battlescribe/bs_helpers";
import { usePromptStore } from "~/stores/promptStore";
const store = usePromptStore();
const isOpen = ref(false);
const promptHtml = ref("");
const promptAccept = ref("Yes");
const promptCancel = ref("Cancel");
const promptId = ref<string | null>(null);
const promptDanger = ref(false);
const promptDontShowAgain = ref(false);
let promptResolve = null as ((response: boolean | null) => void) | null;
globalThis.customPrompt = (data: any) => {
  let shouldOpen = true;
  if (promptResolve !== null) {
    throw new Error("Cannot create a Prompt when one is already active");
  }
  const promise = new Promise<boolean | null>((resolve) => {
    if (typeof data === "string") {
      promptHtml.value = data;
      promptDanger.value = false;
    } else if (isObject(data)) {
      if (data.id && store.get(data.id)) {
        shouldOpen = false;
        resolve(false);
        return;
      }
      promptHtml.value = data.html;
      promptCancel.value = data.cancel ?? "Cancel";
      promptAccept.value = data.accept ?? "Yes";
      promptDontShowAgain.value = false;
      promptId.value = data.id ?? null;
      promptDanger.value = Boolean(data.danger);
    }
    promptResolve = resolve;
  });
  isOpen.value = shouldOpen;
  return promise;
};
function doResolve(result: any) {
  if (promptResolve) {
    promptResolve(result);
    promptResolve = null;
  }
  if (promptDontShowAgain.value && promptId.value) {
    store.set(promptId.value, promptDontShowAgain.value);
  }
  isOpen.value = false;
}
</script>

<template>
  <div class="titlebar">
    <div class="titlebar-content titlebar-left" id="titlebar-content">
      <NuxtLink :to="{ name: 'index' }" class="titlecolor no-underline unselectable">
        <h1 class="flex titletext">
          <img class="logo" src="/assets/icons/logo-menu.svg" />
          <span class="m-auto version">
            New Recruit - Editor <span class="text-slate-300">v{{ version }}</span>
          </span>
        </h1>
      </NuxtLink>
      <slot />
    </div>
    <div class="titlebar-content titlebar-right" id="titlebar-content-right">
      <div class="iconbox no-underline unselectable" @click="settingsOpen = true">
        <IconsGear class="icon-svg" :size="21" />
        <span class="icontext">Settings</span>
      </div>
      <NuxtLink class="iconbox no-underline unselectable" to="/system">
        <IconsGames class="icon-svg" :size="22" />
        <span class="icontext">Systems</span>
      </NuxtLink>
      <a class="iconbox no-underline" href="https://discord.gg/cCtqGbugwb" target="_blank">
        <img class="static-icon" src="/assets/icons/discord.png" />
        <span class="icontext">Discord</span>
      </a>

      <div v-if="electron">
        <img src="/assets/icons/electron32.png" />
      </div>
      <PopupDialog v-if="settingsOpen" v-model="settingsOpen">
        <Settings />
      </PopupDialog>
    </div>
    <Prompt />
  </div>
</template>
<script lang="ts">
import { useSettingsStore } from "~/stores/settingsState";
import Settings from "./Settings.vue";
import Prompt from "./Prompt.vue";

export default {
  data() {
    return {
      settingsOpen: false,
      bug: false,
      feedback: false,
      contact: "",
      text: "",
      text1: "",
      text2: "",
    };
  },
  setup() {
    return { version: useRuntimeConfig().public.clientVersion, settings: useSettingsStore() };
  },
  computed: {
    electron() {
      return Boolean(globalThis.electron);
    },
  },
  components: { Settings, Prompt },
};
</script>
<style scoped lang="scss">
@use "@/shared_components/css/vars.scss" as *;
.titlebar {
  display: flex;
  width: 100%;
  height: 50px;
  background-color: var(--titleBarColor, #708090);
  color: #fff;
  padding: 8px;
  box-sizing: border-box;
  z-index: 2;
}

.titletext {
  color: white;
}

.titlebar-left {
  height: 100%;
  display: flex;
  align-items: center;
}
.titlebar-right {
  height: 100%;
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-direction: row-reverse;
}
.titlebar-content > * {
  margin: 4px;
}
.titlecolor {
  color: black;
}
.icon {
  margin: auto;
  padding: 4px;
  max-height: 20px;
}
/* Inline svg icons inherit the titlebar's white font color (currentColor) instead of being
   flat black PNGs on the pastel-blue bar. Not named ".icon": that class carries the global
   --image-filter, which would re-invert artwork that already follows the theme. */
.icon-svg {
  margin: 2px auto;
}
.static-icon {
  margin: auto;
  padding: 4px;
  max-height: 20px;
}
.icontext {
  font-size: smaller;
  text-align: center;
  text-decoration: none;
  color: white;
}
.iconbox {
  display: flex;
  flex-direction: column;
  /* The Systems box is a NuxtLink, and the global "a { color: $blue }" would otherwise
     beat the titlebar's white and tint its currentColor icon blue */
  color: #fff;
}
.iconbox:hover {
  cursor: pointer;
  background-color: rgba(255, 255, 255, 0.2);
}

.textbox {
  height: 150px;
}

.version {
  font-size: 16px;
  font-weight: normal;
}

h1 img {
  margin-right: 10px;
}

/* Width only: the logo's viewBox is wider than tall, height follows to keep it undistorted */
.logo {
  width: 38px;
}
</style>

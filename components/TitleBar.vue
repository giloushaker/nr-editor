<template>
  <div class="titlebar">
    <div class="titlebar-content titlebar-left" id="titlebar-content">
      <NuxtLink :to="{ name: 'index' }" class="titlecolor no-underline unselectable">
        <h1 class="flex titletext">
          <img class="w-30px h-30px" src="/assets/icons/icon.png" />
          <span class="m-auto version">
            New Recruit - Editor <span class="text-slate-300">v{{ version }}</span>
          </span>
        </h1>
      </NuxtLink>
      <slot />
    </div>
    <div class="titlebar-content titlebar-right" id="titlebar-content-right">
      <div class="iconbox no-underline unselectable" @click="settingsOpen = true">
        <img class="icon" src="/assets/icons/filtre.png" />
        <span class="icontext">Settings</span>
      </div>
      <!-- The icon shows what clicking gets you, not what you are already in: sun to go light,
           moon to go dark. Drawn inline rather than as a PNG so it takes the bar's own colour. -->
      <div class="iconbox no-underline unselectable" @click="settings.toggleTheme()" :title="themeTitle">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <template v-if="settings.isDarkTheme">
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.6 V5 M12 19 V21.4 M2.6 12 H5 M19 12 H21.4 M5.4 5.4 L7.1 7.1 M16.9 16.9 L18.6 18.6 M18.6 5.4 L16.9 7.1 M7.1 16.9 L5.4 18.6" />
          </template>
          <path v-else d="M20.2 14.6 A8.6 8.6 0 0 1 9.4 3.8 A8.6 8.6 0 1 0 20.2 14.6 Z" />
        </svg>
        <span class="icontext">Theme</span>
      </div>
      <NuxtLink class="iconbox no-underline unselectable" to="/system">
        <img class="icon" src="/assets/icons/system2.png" />
        <span class="icontext">Systems</span>
      </NuxtLink>
      <a class="iconbox no-underline" href="https://newrecruit-docs.pages.dev/" target="_blank">
        <img class="icon" src="/assets/icons/book.svg" />
        <span class="icontext">Docs</span>
      </a>
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
    themeTitle() {
      return this.settings.isDarkTheme ? "Switch to the light theme" : "Switch to the dark theme";
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

svg.icon {
  width: 28px;
  height: 28px;
  color: #fff;
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
</style>

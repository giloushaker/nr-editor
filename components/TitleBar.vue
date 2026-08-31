<template>
  <div class="titlebar">
    <div class="titlebar-content titlebar-left" id="titlebar-content">
      <!-- Straight home, not history back: in-app clicks (selections, pages) pollute history, so
           "back" would step through those instead of going up a level. Only on nested pages. -->
      <NuxtLink v-if="nested" class="iconbox no-underline unselectable" :to="{ name: 'index' }" title="Back to home">
        <svg class="icon back" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 5 L8 12 L15 19" />
        </svg>
      </NuxtLink>
      <!-- On nested pages the chevron plus the page's own teleported breadcrumb are the identity. -->
      <NuxtLink
        v-if="!nested"
        :to="{ name: 'index' }"
        class="titlecolor no-underline unselectable"
        :title="`New Recruit - Editor v${version}`"
      >
        <h1 class="flex titletext">
          <img class="logo" src="/assets/favicon.ico" />
          <span class="m-auto version">
            New Recruit - Editor <span class="text-slate-300">v{{ version }}</span>
          </span>
        </h1>
      </NuxtLink>
      <NuxtLink v-if="searchLink" class="iconbox no-underline unselectable" :to="searchLink" title="Search the whole system">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10.5" cy="10.5" r="6.2" />
          <path d="M15.2 15.2 L20.5 20.5" />
        </svg>
      </NuxtLink>
      <slot />
    </div>
    <div class="titlebar-content titlebar-right" id="titlebar-content-right">
      <div class="iconbox no-underline unselectable" @click="settingsOpen = true">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
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
        <!-- Outline version of shared_components/svg/Games.vue's stacking-toy tower -->
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <rect x="6.5" y="2.9" width="11" height="5" rx="2.2" />
          <rect x="4" y="9.5" width="16" height="5" rx="2.2" />
          <rect x="1.5" y="16.1" width="21" height="5" rx="2.2" />
        </svg>
        <span class="icontext">Systems</span>
      </NuxtLink>
      <a class="iconbox no-underline" href="https://newrecruit-docs.pages.dev/" target="_blank">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5.6 C10 3.9 7.6 3.3 4.4 3.3 V18.4 C7.6 18.4 10 19 12 20.7 C14 19 16.4 18.4 19.6 18.4 V3.3 C16.4 3.3 14 3.9 12 5.6 Z" />
          <path d="M12 5.6 V20.7" />
        </svg>
        <span class="icontext">Docs</span>
      </a>
      <a class="iconbox no-underline" href="https://discord.gg/cCtqGbugwb" target="_blank">
        <img class="static-icon" src="/assets/icons/discord.png" />
        <span class="icontext">Discord</span>
      </a>

      <!--
        A script running on its own -- a hook, not a button. It borrows the titlebar because there
        is no card to draw a bar on, and it is quiet enough to sit through a repeated auto-run
        without becoming noise the way a toast would.
      -->
      <div v-if="scripts.background" class="script-running" :title="progressTitle">
        <span class="spinner" />
        <span class="label">{{ scripts.background.label }}</span>
        <span v-if="progressText" class="count">{{ progressText }}</span>
      </div>

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
import { useScriptsStore } from "~/stores/scriptsStore";
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
    return {
      version: useRuntimeConfig().public.clientVersion,
      settings: useSettingsStore(),
      scripts: useScriptsStore(),
    };
  },
  computed: {
    /** Pages a level below the index: the ones whose titlebar earns a back chevron. */
    nested(): boolean {
      return ["catalogue", "scripts-id", "search-id"].includes(this.$route.name as string);
    },
    /** The system search page for whatever system is open; the editor is the page that knows one. */
    searchLink(): string | null {
      const id = this.$route.name === "catalogue" && (this.$route.query as Record<string, string>).systemId;
      return id ? `/search/${id}` : null;
    },
    progressText(): string {
      const p = this.scripts.background?.progress;
      if (!p) return "";
      return p.max ? `${p.current} / ${p.max}` : String(p.current);
    },
    progressTitle(): string {
      const p = this.scripts.background?.progress;
      return [this.scripts.background?.label, p?.message].filter(Boolean).join(" — ");
    },
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

.script-running {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #ffffff;
  opacity: 0.9;
  white-space: nowrap;
}

.script-running .count {
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}

/* Borders rather than an image, so it takes the bar's own colour and needs no asset. */
.spinner {
  width: 11px;
  height: 11px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #ffffff;
  border-radius: 50%;
  display: inline-block;
  flex: none;
  animation: titlebar-spin 0.7s linear infinite;
}

@keyframes titlebar-spin {
  to {
    transform: rotate(360deg);
  }
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

/* One family for every nav glyph: 24-viewBox outline svgs, 1.8 stroke, 20px box. Black so the
   global --image-filter (app.vue's svg.icon rule) lightens them all together on the dark theme. */
svg.icon {
  width: 20px;
  height: 20px;
  color: #000;
}
/* The chevron stands alone with no label, so it gets more of the bar's height than the glyphs above text. */
svg.icon.back {
  width: 28px;
  height: 28px;
}
/* Deliberately outside the monochrome pipeline: the Discord roundel keeps its brand colours. */
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

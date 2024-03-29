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
      <!-- <div class="iconbox" @click="bug = true">
        <img src="/assets/icons/bug.png" class="icon" />
        <span class="icontext">Bug</span>
      </div>
      <div class="iconbox" @click="feedback = true">
        <img src="/assets/icons/feedback.png" class="icon" />
        <span class="icontext">Feedback</span>
      </div> -->
      <div class="iconbox no-underline unselectable" @click="settingsOpen = true">
        <img class="icon" src="/assets/icons/filtre.png" />
        <span class="icontext">Settings</span>
      </div>
      <NuxtLink v-if="electron" class="iconbox no-underline unselectable" to="/system">
        <img class="icon" src="/assets/icons/system2.png" />
        <span class="icontext">Systems</span>
      </NuxtLink>
      <a class="iconbox no-underline" href="https://discord.gg/cCtqGbugwb" target="_blank">
        <img class="static-icon" src="/assets/icons/discord.png" />
        <span class="icontext">Discord</span>
      </a>

      <div v-if="electron">
        <img src="/assets/icons/electron32.png" />
      </div>

      <PopupDialog v-if="bug" :disabled="!can_submit_bug" v-model="bug" button="Submit" @button="submit_bug">
        <div class="m-20px">
          <h2 class="text-center">Bug Report form</h2>
          <label for="contact">Contact:</label>
          <div>
            <input type="text" id="contact" v-model="contact" />
          </div>
          <label for="text1">What happened <span class="gray">(include the steps to reproduce)</span>:*</label>
          <textarea required class="w-full textbox" type="text" id="text1" v-model="text1" />

          <label for="text2">What did you expect to happen:*</label>
          <textarea required class="w-full mt-1px textbox" type="text" id="text2" v-model="text2" />
        </div>
      </PopupDialog>
      <PopupDialog
        v-if="feedback"
        :disabled="!can_submit_feedback"
        v-model="feedback"
        button="Submit"
        @button="submit_feedback"
      >
        <div class="m-20px">
          <h2 class="text-center">Feedback form</h2>
          <label for="contact">Contact:</label>
          <div>
            <input type="text" id="contact" v-model="contact" />
          </div>
          <label for="text"> Do you have any suggestions to improve NewRecruit ?:* </label>
          <textarea required class="w-full mt-1px textbox" type="text" id="text" v-model="text" />
        </div>
      </PopupDialog>
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
    can_submit_bug() {
      return this.text1 && this.text2;
    },
    can_submit_feedback() {
      return this.text;
    },
    electron() {
      return Boolean(globalThis.electron);
    },
  },
  methods: {
    submit_bug() {
      const data = {
        contact: this.contact,
        happened: this.text1,
        expected: this.text2,
        type: "bug",
      };
      fetch("https://corsproxy.io/?https://www.newrecruit.eu/api/feedback", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    submit_feedback() {
      const data = {
        contact: this.contact,
        content: this.text,
        type: "suggestion",
      };
      fetch("https://corsproxy.io/?https://www.newrecruit.eu/api/feedback", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
  },
  components: { Settings, Prompt },
};
</script>
<style scoped lang="scss">
@import "@/shared_components/css/vars.scss";
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

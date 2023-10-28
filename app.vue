<template>
  <div id="popups" />
  <div id="dialogs" />
  <div id="app">
    <Notifications :style="{ 'margin-top': `${titleSize + 5}px` }" position="top center" />

    <ClientOnly>
      <div class="title" ref="title" @resize="update">
        <TitleBar />
      </div>
      <div class="content" :style="{ height: `calc(100vh - ${titleSize}px)` }">
        <NuxtPage :keepalive="true" />
      </div>
    </ClientOnly>
  </div>
</template>

<script lang="ts">
import TitleBar from "./components/TitleBar.vue";
import { notify } from "@kyvg/vue3-notification";
import { useSettingsStore } from "./stores/settingsState";

export default defineComponent({
  data() {
    return {
      val: "",
      titleSize: 50,
    };
  },
  methods: {
    update() {
      this.titleSize = (this.$refs.title as HTMLDivElement).clientHeight;
    },
  },
  setup() {
    return {
      settings: useSettingsStore(),
    };
  },
  mounted() {
    addEventListener("resize", this.update);
  },
  unmounted() {
    removeEventListener("resize", this.update);
  },
  async created() {
    this.settings.refreshAppearance();
    globalThis.isEditor = true;
    globalThis.notify = notify;

    if (!globalThis.electron) {
      // Prevent errors when accessing undeclare global var
      (globalThis as any).electron = null;
    }
  },
  watch: {
    "settings.theme"() {
      this.settings.refreshAppearance();
    },
  },
  components: { TitleBar },
});
</script>

<style lang="scss">
@import "@/shared_components/css/vars.scss";

#app {
  padding: 0 !important;
  height: 100%;
  width: 100%;
  position: fixed;
}

html {
  font-family: sans-serif;
  background-image: linear-gradient(
    rgba(var(--bg-r), var(--bg-g), var(--bg-b), var(--bg-a)),
    rgba(var(--bg-r), var(--bg-g), var(--bg-b), var(--bg-a))
  );
  background-size: var(--backgroundSize);
  background-color: rgb(var(--bg-r), var(--bg-g), var(--bg-b));
  filter: var(--global-filter);
  color: var(--font-color);
}

img.icon,
svg.icon,
img.imgBt {
  filter: var(--image-filter);
}

.bouton {
  color: var(--font-color) !important;

  &:hover {
    border-color: $input_highlights !important;
  }
}

input:hover,
button:hover {
  border-color: $input_highlights !important;
  filter: brightness(110%);
}

select:hover {
  border-color: $input_highlights;
}

.autocomplete-input,
select,
input[type="date"],
input[type="number"],
input[type="search"],
input[type="text"],
input[type="password"],
input[type="email"],
input[role="combobox"],
button,
a.bouton,
textarea {
  border-radius: var(--input-radius);
  background-color: var(--input-background);
  color: var(--font-color);
}

body {
  font-family: $font;
  font-size: $fontSize;
}

input[type="button"],
input[type="submit"],
input[type="reset"],
button,
.bouton {
  font-family: $fontButton !important;
  font-size: $fontButtonSize !important;
  font-weight: bold;
}

a {
  color: $blue;
}

.optName {
  color: $blue;
  font-weight: bold;
}

.unitName {
  color: $blue;
  font-weight: bold;
}

.warning {
  color: $orange;
  font-weight: bold;
}

.error {
  color: $red;
  font-weight: bold;
}

.message {
  color: $light_blue;
  font-weight: bold;
}

.autocomplete-input,
select,
input[type="date"],
input[type="number"],
input[type="text"],
input[type="search"],
input[type="password"],
input[type="email"],
input[role="combobox"],
button[class="bouton"],
a.bouton {
  font-family: $fontButton !important;
  font-size: $fontButtonSize !important;
}

.date {
  color: $gray;
  font-style: italic;
  font-size: 16px;
}

.red {
  color: $red;
}

.green {
  color: $green;
}

.blue {
  color: $blue;
}

.grey,
.gray {
  color: $gray;
}

.conditional {
  color: $green !important;
}

p.info {
  font-style: italic;
  color: $gray;
  border: 1px black dashed;
  padding: 5px;
  position: relative;
  border-radius: 10px;
  margin-top: 10px;

  width: fit-content;

  &:before {
    content: url(assets/icons/i.png) " ";
    position: absolute;
    top: -5px;
    left: -8px;
  }

  font-weight: normal;
  margin-bottom: 10px;
}

p.hidden {
  display: none;
}

button.bouton[disabled] {
  color: $gray !important;

  &:hover {
    filter: none;
    border-color: $box_border !important;
  }

  cursor: auto !important;
}

.cost {
  color: $cost_color;
  background-color: rgba(0, 0, 0, 0.09);
  padding: 2px;
  padding-top: 1px;
  padding-bottom: 1px;
  margin-right: 7px;
  border-radius: 5px;
  font-weight: normal !important;

  &:last-child {
    &::after {
      content: "" !important;
    }
  }
}

.costList {
  color: $gray;
  font-weight: normal;
  white-space: nowrap;

  &.error {
    &::after {
      vertical-align: -2px;
      margin-right: 3px;
      content: url(assets/icons/error_exclamation.png) !important;
    }
  }
}

.titleCosts {
  .costList {
    margin-right: 20px;
  }
}

@media screen and (max-width: $very_large_mode) {
  .hideOnSmallScreen {
    display: none;
  }
}

@media screen and (min-width: $very_large_mode) {
  .hideOnLargeScreen {
    display: none;
  }
}

@media screen and (min-width: $large_mode) {
  html {
    /* Handle */
    ::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 5px;
    }

    /* Handle on hover */
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.4);
    }

    /* Handle on mouse */
    ::-webkit-scrollbar-thumb:active {
      background: rgba(0, 0, 0, 0.5);
    }

    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
  }
}

fieldset {
  border: 1px solid $box_border;
}

table {
  border-color: $box_border;
}

.arrowTitle {
  font-size: $fontHeaderSize !important;
}

.h1,
h2,
h3,
h4,
h5,
h6,
.arrowTitle {
  font-family: $fontHeader !important;
  text-transform: $fontHeaderTransform;
}

.info {
  margin-left: 10px;
}
</style>

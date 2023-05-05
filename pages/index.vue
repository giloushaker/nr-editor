<template>
  <CollapsibleBox>
    <template #title>Titre</template>
    <template #content>Contenu</template>
  </CollapsibleBox>
</template>

<script lang="ts">
import CollapsibleBox from "~/shared_components/CollapsibleBox.vue";

export default {
  components: { CollapsibleBox },
};
</script>

<style lang="scss">
@import "@/shared_components/css/vars.scss";

html {
  font-family: sans-serif;
  background-image: linear-gradient(
      rgba(var(--bg-r), var(--bg-g), var(--bg-b), var(--bg-a)),
      rgba(var(--bg-r), var(--bg-g), var(--bg-b), var(--bg-a))
    ),
    var(--bg-texture);
  background-size: var(--backgroundSize);
  background-color: rgb(var(--bg-r), var(--bg-g), var(--bg-b));
  filter: var(--global-filter);
  color: var(--font-color);
}

img.icon,
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
input[type="text"],
input[type="password"],
input[type="email"],
input[role="combobox"],
button,
a.bouton {
  border-radius: var(--input-radius);
  background-color: var(--input-background);
  color: var(--font-color);
}

.mainMenu {
  position: fixed;
  left: 0;
  right: 0;
}

.mainContent {
  position: fixed;
  top: 45px;
  padding: $margin;
  bottom: 0;
  left: 0;
  right: 0;
  overflow-y: auto;
}

@media screen and (max-width: $large_mode) {
  .mainContent {
    padding-left: $small_margin;
    padding-right: $small_margin;
    overflow-y: auto;
    top: 82px;
  }

  .mainContent.hiddenMobile {
    top: 45px;
  }
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
  font-weight: bold !important;
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
input[type="password"],
input[type="email"],
input[role="combobox"],
button[class="bouton"],
a.bouton {
  font-family: $fontButton !important;
  font-size: $fontButtonSize !important;
}

a.ruleLink {
  color: $fontColor;
}

a.ruleLink.optRule {
  color: $blue;
}

a.ruleLink.lostRule {
  color: $red !important;
  text-decoration: line-through;
}

a.ruleLink.invisible {
  display: none;
}

.date {
  color: $gray;
  font-style: italic;
  font-size: 16px;
}

.game-assist {
  h2 {
    text-align: center;
    margin-bottom: 10px;
    border-bottom: $dotted_border;

    .subtitle {
      font-size: 16px;
      font-weight: normal;
      color: $gray;
    }
  }

  h3 {
    font-size: 16px;
    margin-bottom: 5px;
  }

  h4 {
    font-size: 16px;
    text-align: center;
    margin-top: 5px;
    margin-bottom: 5px;
  }

  .result {
    display: grid;
    justify-items: center;
  }
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

.cast_0 {
  color: red;
}

.cast_1 {
  color: blue;
  font-weight: bold;
}

.cast_2 {
  color: green;
}

.affectpairings {
  color: $blue;
}

.cast_amp {
  color: #988d04;
  font-weight: bold;
}

.cast_oaken {
  color: orange;
}

.conditional {
  color: $green !important;
}

.fluff p {
  font-style: italic;
}

.listDeletion {
  color: $orange;
}

.dg-btn--ok,
.dg-btn--cancel {
  width: auto;
  background-color: white !important;
  color: black !important;
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
    content: url(/assets/icons/i.png) " ";
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

form:invalid a.submit {
  color: $gray;
}

.selectGrid {
  display: grid;
  grid-template-columns: 250px 30px;
  align-content: center;
  align-items: center;
  grid-gap: 5px;

  .imageBouton {
    padding-right: 0;
  }

  .bouton,
  select {
    width: auto;
  }
}

@media screen and (max-width: $mobile_mode) {
  .selectGrid {
    grid-template-columns: 1fr auto;
  }
}

.iconeBouton {
  width: 22px;
  padding-right: 0 !important;
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
      content: url(/assets/icons/error_exclamation.png) !important;
    }
  }
}

.titleCosts {
  .costList {
    margin-right: 20px;
  }
}

.unitStatus {
  color: #8035e2;
  background-color: rgba(0, 0, 0, 0.09);
  padding: 2px;
  padding-top: 1px;
  padding-bottom: 1px;
  margin-right: 7px;
  border-radius: 5px;
  font-weight: normal !important;
  font-style: italic;
  text-decoration: none !important;
}

#vueListe {
  min-height: 400px;

  h2 {
    .costList {
      font-size: 16px;
    }
  }
}

.rightButtons {
  float: right;
  display: grid;
  grid-auto-flow: column;
  grid-gap: 10px;
}

h4.subtitle {
  margin-top: 0;
  font-style: italic;
  color: $gray;
  font-style: italic;
  font-weight: normal;
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
    }
  }
}

@media screen and (min-width: $large_mode) {
  .splitMainContent > div.tableList {
    position: absolute;
    bottom: 10px;
    left: 10px;
    right: 10px;
    top: 10px;
    display: flex;
    flex-direction: column;
  }
}

.dg-container {
  color: black !important;

  input {
    background-color: white !important;
    color: black !important;
  }

  input:hover,
  button:hover {
    border-color: #009cbd !important;
    filter: brightness(110%);
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

.testBanner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: grid;
  justify-content: center;
  align-content: center;
  height: 44px;
  font-weight: bolder;
  background-color: rgb(55, 83, 211);
  opacity: 0.75;
  font-size: 24px;
  color: rgb(255, 208, 0);
  z-index: 1000;
  pointer-events: none;
}
</style>

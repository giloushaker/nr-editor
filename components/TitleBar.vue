<template>
  <div class="titlebar">
    <div class="titlebar-content titlebar-left inline" id="titlebar-content">
      <h1>NR-Editor</h1>
      <slot />
    </div>
    <div
      class="titlebar-content titlebar-right inline"
      id="titlebar-content-right"
    >
      <div>Right1</div>
      <div>Right2</div>
    </div>
  </div>
</template>

<style>
.titlebar {
  display: flex;
  position: sticky;
  top: 0;
  left: 0;
  width: 100%;
  height: 50px;
  background-color: #333;
  color: #fff;
  padding: 10px;
  box-sizing: border-box;
  z-index: 1;
}
.titlebar-left {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 10px;
}
.titlebar-right {
  margin-left: auto;
  display: flex;
  flex-flow: row-reverse;
  flex-direction: row-reverse;
  align-items: center;
  height: 100%;
  padding: 0 10px;
}
.titlebar-content > * {
  margin: 4px;
}
</style>

<template>
  <div class="titlebar">
    <div class="titlebar-content titlebar-left" id="titlebar-content">
      <NuxtLink :to="{ name: 'index' }">
        <h1>NR-Editor</h1>
      </NuxtLink>
      <slot />
    </div>
    <div class="titlebar-content titlebar-right" id="titlebar-content-right">
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
  padding: 8px;
  box-sizing: border-box;
  z-index: 1;
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
</style>

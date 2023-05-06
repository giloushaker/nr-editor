<template>
  <div class="titlebar">
    <div class="titlebar-content" id="titlebar-content">
      <h1>NR-Editor</h1>
    </div>
    <slot />
  </div>
</template>

<style>
.titlebar {
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
.titlebar-content {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 10px;
}
</style>

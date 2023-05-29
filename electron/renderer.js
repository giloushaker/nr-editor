// @ts-ignore Dont remove unused import, having it imported early prevents errors in the console
import { Dexie } from "dexie";
console.log("renderer.js script");
export default defineNuxtPlugin((nuxt) => {
  console.log("renderer.js defineNuxtPlugin");
});

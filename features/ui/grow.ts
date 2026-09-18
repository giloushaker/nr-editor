/** v-grow: a textarea that is as tall as its text, one line when empty. */
import type { Directive } from "vue";

function grow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + 2}px`;
}
export const vGrow: Directive<HTMLTextAreaElement> = {
  mounted(el) {
    grow(el);
    el.addEventListener("input", () => grow(el));
  },
  updated: grow,
};

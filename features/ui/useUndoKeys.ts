/**
 * Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) for a page whose writes go through the editor store.
 * Left alone while a text field has focus: there the browser's own text undo applies.
 */
import { onBeforeUnmount, onMounted, type Ref } from "vue";

export function useUndoKeys(active: Ref<boolean>, undo: () => Promise<unknown>, redo: () => Promise<unknown>) {
  function onKey(e: KeyboardEvent) {
    if (!active.value || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    const t = e.target as HTMLElement | null;
    if (t?.closest("input, textarea, select, [contenteditable]")) return;
    e.preventDefault();
    if (key === "y" || e.shiftKey) redo();
    else undo();
  }
  onMounted(() => document.addEventListener("keydown", onKey));
  onBeforeUnmount(() => document.removeEventListener("keydown", onKey));
}

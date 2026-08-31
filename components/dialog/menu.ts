/**
 * A context menu described as data, rendered by ContextMenuItems.vue.
 *
 * A menu is an array of groups; a separator is drawn between whichever groups end up with
 * items in them. Nothing else knows about separators, which is the point -- they used to be
 * written by hand next to the items, each repeating the conditions of the group above it.
 */
export interface MenuItem {
  label: string;
  /** Path under /assets, written without a leading slash so it resolves from the route. */
  icon?: string;
  /** Extra classes on the icon, for the odd one that needs constraining. */
  iconClass?: string;
  /** Greyed suffix after the label -- which catalogue a target lives in, and the like. */
  note?: string;
  /** Greyed and right-aligned: the keyboard shortcut that does the same thing. */
  shortcut?: string;
  run?: () => unknown;
  /** Present and non-empty turns the item into a submenu; the item itself stays clickable. */
  children?: MenuItem[];
  /** Submenu registration key, unique within one menu. Defaults to the label. */
  submenuId?: string;
}

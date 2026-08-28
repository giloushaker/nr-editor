import type { useEditorStore } from "~/stores/editorStore";
import type { HookAction } from "~/stores/scriptsStore";
import { getNameExtra, getTypeLabel, getTypeName, type ItemKeys } from "~/assets/editor/bs_editor";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { Base, Link, Profile, ProfileType } from "~/assets/shared/battlescribe/bs_main";
import type { MenuItem } from "~/components/dialog/menu";

/**
 * What the menu needs from the tree entry that owns it.
 *
 * Spelled out rather than taking the component, so the menu can be read (and changed, and
 * eventually tested) without the component around it. CatalogueEntry satisfies this
 * structurally, so it passes itself.
 */
export interface EntryMenuContext {
  store: ReturnType<typeof useEditorStore>;
  item: EditorBase;
  catalogue: Catalogue;
  imported?: boolean;
  /** The item as a link; only read when store.can_follow says it is one. */
  link: Link & EditorBase;
  /** A condition's childId target, when it has one. */
  child?: EditorBase;
  profileTypes: ProfileType[];
  scriptActions: HookAction[];
  allowed(child: string | string[]): boolean;
  sortable(entry?: EditorBase): boolean;
}

/** Whether the catalogue already has a root entryLink pointing at this shared entry. */
function hasRootLink(catalogue: Catalogue, item: Base) {
  return catalogue.entryLinks?.find((o) => o.targetId === item.id);
}

/**
 * The context menu for a tree entry, as data.
 *
 * Called from a method rather than a computed on purpose: every node in the tree owns one of
 * these, and a computed would be evaluated for all of them. This runs only when a menu is
 * actually open, which is why the whole thing can afford to be built from scratch each time.
 *
 * `payload` is set when the right-click landed on one of a catalogue's category headers,
 * where the only thing on offer is creating that kind of child.
 *
 * Groups are declared in display order and drawn with a separator between whichever ones
 * come out non-empty, so an item can be added or dropped without touching its neighbours.
 * A script's `context` hook may name any group below to place its item there; anything
 * else lands in the Scripts submenu.
 */
export function buildEntryMenu(ctx: EntryMenuContext, payload?: ItemKeys): MenuItem[][] {
  const store = ctx.store;
  const item = ctx.item as EditorBase;
  const bs = (icon: string) => `assets/bsicons/${icon}.png`;
  const groups: Record<string, MenuItem[]> = {};
  const order: string[] = [];
  /** Falsy entries are how a condition is written inline; they never reach the menu. */
  const group = (name: string, items: Array<MenuItem | false | undefined | null | "">) => {
    order.push(name);
    groups[name] = items.filter(Boolean) as MenuItem[];
  };
  const otherCatalogue = (node?: { getCatalogue?: () => Catalogue | undefined }) => {
    const found = node?.getCatalogue?.();
    return found && found !== item.getCatalogue() ? `[${found.getName()}]` : undefined;
  };

  const link = ctx.link;
  const child = ctx.child;
  const profileType = item.isProfile() && item.typeId ? ctx.catalogue.findOptionById(item.typeId) : undefined;
  const refCount = (item.refs?.length ?? 0) + (item.other_refs?.length ?? 0);

  group(
    "navigate",
    payload
      ? []
      : [
          store.can_follow(item) && {
            label: "Follow",
            shortcut: "Alt+Click",
            note: link.target.getCatalogue() !== item.getCatalogue()
              ? `[${link.target.getCatalogue()?.getName() || link.target.getName()}]`
              : undefined,
            run: () => store.follow(link),
          },
          ctx.imported && {
            label: "Goto",
            shortcut: "Alt+Click",
            note: `(${item.getCatalogue()?.getName()})`,
            run: () => store.goto(item),
          },
          profileType && {
            label: `Goto ${(item as EditorBase & Profile).typeName}`,
            shortcut: "Alt+Click",
            note: `[${profileType.getCatalogue().getName()}]`,
            run: () => store.goto(profileType as EditorBase & ProfileType),
          },
          child && store.can_goto(child) && {
            label: `Goto ${child.getName()}`,
            shortcut: "Alt+Click",
            note: otherCatalogue(child),
            run: () => store.goto(child),
          },
          refCount > 0 && { label: `References (${refCount})`, run: () => (store.mode = "references") },
          store.filter && !item.showChildsInEditor && {
            label: "Show All Childs",
            shortcut: "Space",
            run: () => store.toggle_selections(),
          },
        ],
  );

  if (payload) {
    const type = getTypeName(payload);
    group("create", [
      { label: getTypeLabel(type), icon: bs(type), run: () => store.create(payload) },
      payload === "selectionEntries" && {
        label: "Link",
        icon: bs("link"),
        run: () => store.create("entryLinks", { type: "selectionEntry" }),
      },
      payload === "rules" && {
        label: "Link",
        icon: bs("link"),
        run: () => store.create("infoLinks", { type: "rule" }),
      },
    ]);
  } else {
    const allowed = (key: string | string[]) => ctx.allowed(key);
    group("create.force", [
      allowed("forceEntries") && { label: "Force", icon: bs("forceEntry"), run: () => store.create("forceEntries") },
      allowed("categoryLinks") && item.isForce() && {
        label: "Category",
        icon: bs("categoryEntryLink"),
        run: () => store.create("categoryLinks"),
      },
    ]);
    group("create.entry", [
      allowed("selectionEntries") && {
        label: "Entry",
        icon: bs("selectionEntry"),
        run: () => store.create("selectionEntries"),
      },
      allowed("selectionEntryGroups") && {
        label: "Group",
        icon: bs("selectionEntryGroup"),
        run: () => store.create("selectionEntryGroups"),
      },
      allowed(["entryLinks", "infoLinks", "forceEntryLinks"]) && {
        label: "Link",
        icon: bs("link"),
        submenuId: "link_contextmenu",
        run: () => store.create("entryLinks", { type: "selectionEntry" }),
        children: [
          ...(allowed("entryLinks")
            ? [
                {
                  label: "Entry",
                  icon: bs("selectionEntryLink"),
                  run: () => store.create("entryLinks", { type: "selectionEntry" }),
                },
                {
                  label: "Group",
                  icon: bs("selectionEntryGroupLink"),
                  run: () => store.create("entryLinks", { type: "selectionEntryGroup" }),
                },
              ]
            : []),
          ...(allowed("infoLinks")
            ? [
                {
                  label: "Profile",
                  icon: bs("profileLink"),
                  run: () => store.create("infoLinks", { type: "profile" }),
                },
                { label: "Rule", icon: bs("ruleLink"), run: () => store.create("infoLinks", { type: "rule" }) },
                {
                  label: "InfoGroup",
                  icon: bs("infoGroupLink"),
                  run: () => store.create("infoLinks", { type: "infoGroup" }),
                },
                {
                  label: "Association",
                  icon: bs("associationLink"),
                  run: () => store.create("associationLinks", { type: "association" }),
                },
              ]
            : []),
          ...(allowed("forceEntryLinks")
            ? [{ label: "Force", icon: bs("forceEntryLink"), run: () => store.create("forceEntryLinks") }]
            : []),
        ],
      },
    ]);
    group("create.info", [
      allowed("profiles") && {
        label: "Profile",
        icon: bs("profile"),
        submenuId: "profile_contextmenu",
        run: () => store.create_child("profiles", item),
        children: ctx.profileTypes.map((type) => ({
          label: type.getName(),
          icon: bs("profile"),
          note: getNameExtra(type as ProfileType & EditorBase, false) || undefined,
          run: () => store.create_child("profiles", item, { typeId: type.id, typeName: type.name }),
        })),
      },
      allowed("rules") && { label: "Rule", icon: bs("rule"), run: () => store.create("rules") },
      allowed("infoGroups") && {
        label: "Info Group",
        icon: bs("infoGroup"),
        run: () => store.create("infoGroups"),
      },
      allowed("associations") && {
        label: "Association",
        icon: bs("association"),
        run: () => store.create("associations"),
      },
    ]);
    group("create.type", [
      allowed("characteristicTypes") && {
        label: "Characteristic Type",
        icon: bs("characteristicType"),
        run: () => store.create("characteristicTypes"),
      },
      allowed("attributeTypes") && {
        label: "Attribute Type",
        icon: bs("attributeType"),
        run: () => store.create("attributeTypes"),
      },
    ]);
    group("create.condition", [
      allowed("conditions") && { label: "Condition", icon: bs("condition"), run: () => store.create("conditions") },
      allowed("conditionGroups") && {
        label: "Condition Group",
        icon: bs("conditionGroup"),
        run: () => store.create("conditionGroups"),
      },
      allowed("localConditionGroups") && {
        label: "Local Condition Group",
        icon: bs("conditionGroup"),
        run: () => store.create("localConditionGroups"),
      },
      allowed("repeats") && { label: "Repeat", icon: bs("repeat"), run: () => store.create("repeats") },
    ]);
    group("create.constraint", [
      allowed("constraints") && {
        label: "Constraint",
        icon: bs("constraint"),
        run: () => store.create_child("constraints", item),
      },
    ]);
    group("create.modifier", [
      allowed("modifiers") && { label: "Modifier", icon: bs("modifier"), run: () => store.create("modifiers") },
      item.editorTypeName === "constraint" && item.parent && {
        label: "Modifier",
        note: "(on parent, for this constraint)",
        icon: bs("modifier"),
        run: () => store.create_child("modifiers", item.parent!, { field: item.id, value: 0 }),
      },
      allowed("modifierGroups") && {
        label: "Modifier Group",
        icon: bs("modifierGroup"),
        run: () => store.create("modifierGroups"),
      },
    ]);
  }

  const moveTargets = payload ? [] : (store.get_move_targets(item) ?? []);
  group("edit", [
    !payload && { label: "Cut", shortcut: "Ctrl+X", run: () => store.cut() },
    !payload && { label: "Copy", shortcut: "Ctrl+C", run: () => store.copy() },
    { label: "Paste", shortcut: "Ctrl+V", run: () => store.paste() },
    !payload && { label: "Duplicate", shortcut: "Ctrl+D", run: () => store.duplicate() },
    !payload && !ctx.sortable(item.parent) && {
      label: "Move Up",
      shortcut: "Alt+⭡",
      run: () => store.move_up(item),
    },
    !payload && !ctx.sortable(item.parent) && {
      label: "Move Down",
      shortcut: "Alt+⭣",
      run: () => store.move_down(item),
    },
    moveTargets.length > 0 && {
      label: "Move To",
      submenuId: "moveto_contextmenu",
      children: moveTargets.map((target) => ({
        label: `${target.target.name} - ${target.type}`,
        icon: bs("catalogue"),
        run: () => store.move(item, ctx.catalogue, target.target, target.type),
      })),
    },
    item.parentKey === "sharedSelectionEntries" && {
      label: "Add Root Link",
      note: hasRootLink(ctx.catalogue, item) ? "(already has one)" : undefined,
      run: () =>
        store.create_child("entryLinks", ctx.catalogue, {
          targetId: item.id,
          type: "selectionEntry",
          name: item.getName(),
        }),
    },
  ]);

  group(
    "remove",
    payload
      ? []
      : [
          {
            label: "Remove",
            icon: "assets/icons/redcross.png",
            iconClass: "w-12px",
            shortcut: "Del",
            run: () => store.remove(),
          },
        ],
  );

  // Scripts choose a group by name; the ones that don't get their own submenu, which is
  // where every script action used to go whether it belonged there or not.
  const loose: MenuItem[] = [];
  for (const action of ctx.scriptActions) {
    const entry: MenuItem = { label: action.label, icon: action.icon, run: action.run };
    if (action.group && groups[action.group]) groups[action.group].push(entry);
    else loose.push({ ...entry, icon: entry.icon ?? "assets/icons/right2.png" });
  }
  if (loose.length && !payload) {
    groups.edit.push({ label: "Scripts", submenuId: "scripts_contextmenu", children: loose });
  }

  return order.map((name) => groups[name]);
}
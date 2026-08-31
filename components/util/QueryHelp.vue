<template>
  <PopupDialog :modelValue="true" @update:modelValue="$emit('close')" x slotstyle="max-width: 1100px; width: 95vw">
    <template #header>Search syntax</template>
    <div class="help" @copy="onCopy">
      <div class="top">
        <p class="intro">{{ intro }}</p>
        <button class="inputstyle" :title="copied ? 'Copied' : 'Copy the whole sheet as Markdown, e.g. to paste into an AI'" @click="copy">
          {{ copied ? "Copied" : "Copy as text" }}
        </button>
      </div>
      <div class="cols">
        <div v-for="(column, c) in [left, right]" :key="c" class="col">
          <section v-for="group in column" :key="group.title">
            <h4>
              {{ group.title }}
              <span v-if="group.sub" class="sub">{{ group.sub }}</span>
            </h4>
            <table>
              <tr v-for="[example, meaning] in group.rows" :key="example">
                <template v-if="group.icons">
                  <td class="label">{{ meaning }}</td>
                  <td class="chips">
                    <span v-for="k in example.split(' ')" :key="k" class="kind"><img class="typeIcon" :src="`assets/bsicons/${icon(k)}.png`" /><code>{{ k }}</code></span>
                  </td>
                </template>
                <template v-else>
                  <td :class="{ list: group.list }">
                    <template v-if="group.list"><code v-for="k in example.split(' ')" :key="k">{{ k }}</code></template>
                    <code v-else>{{ example }}</code>
                  </td>
                  <td>{{ meaning }}</td>
                </template>
              </tr>
            </table>
          </section>
        </div>
      </div>
    </div>
  </PopupDialog>
</template>

<script lang="ts">
import { isValues } from "~/assets/editor/bs_search";
import { shortNames } from "~/assets/editor/bs_editor";

/** `group` -> `selectionEntryGroup`: the icons are named by the long type names. */
const LONG_NAMES: Record<string, string> = Object.fromEntries(Object.entries(shortNames).map(([long, short]) => [short, long]));

type Rows = Array<[string, string]>;
interface Group {
  title: string;
  sub?: string;
  rows: Rows;
  /** The first column is a list of words, each its own chip. */
  list?: boolean;
  /** ...with the kind's icon in front. */
  icons?: boolean;
  /** Only meaningful in front of the box; left out of the Markdown copy. */
  screenOnly?: boolean;
}

const intro =
  "Terms are separated by spaces and all must match. A bare word searches names, comments, descriptions and " +
  "characteristic text; key:value asks about one field. The second box groups the results. " +
  "has/in look any depth away; child/parent look exactly one level.";

const left: Group[] = [
  {
    title: "Words",
    rows: [
      ["power fist", "both words, anywhere in the text fields"],
      ['"power fist"', "that exact phrase"],
      ["-hidden  !hidden", "nodes without the word — either prefix negates"],
      ['"scope:force"', "quoted, a key:value is searched as plain text"],
    ],
  },
  {
    title: "Fields",
    rows: [
      ["name:scout", "contains"],
      ["name=Scouts  name:=Scouts", "equals exactly"],
      ["is:entry|group", "either one — | is or; with = every alternative is exact"],
      ["-is:entryLink  !is:entryLink", "not"],
      ["name!=Scouts  name!:scout", "not equal / not containing; with | it means none of them"],
      ["childId:any  childId:*", "the field is set"],
      ["id:none  affects:undefined", "the field is absent — none, undefined and null all mean it"],
      ["value:>0  value:>=2  value:<10", "numbers compare: > >= < <="],
      ["refs:0  refs:>2", "a list answers with its count"],
      ["key:shared*  name:*pistol", "wildcard, against the whole value"],
      ["name:/\\s$/  name:/[’“]/", "regular expression; case-insensitive unless you give flags"],
      ['name:"any"  name:"*"', "quoted, the word itself rather than its special meaning"],
      ["parent.type:unit  target.name:x", "a dotted path: through parent, target, catalogue, refs, mentions"],
      ["description.length:>100", ".length on any text field, compared as a number"],
      ["characteristics.S:>4", "one characteristic by name; quote a spaced one: characteristics.\"Unit Strength\":1"],
      ["shared:true  collective:false", "booleans; an unset flag counts as its default"],
      ["is:entryLink → by:catalogue,target.catalogue", "the only way to compare two fields: group by both and read the groups."],
    ],
  },
  {
    title: "Structure",
    sub: "a kind or *, then an optional [query]; brackets nest",
    rows: [
      ["has:constraint[scope:force]", "something anywhere below it matches (any depth)"],
      ['in:entry["bolt rifle"]', "something anywhere above it matches (any depth)"],
      ["child:profile[kind:model]  parent:entry[type:unit]", "a direct child / the direct parent matches — one level, no depth"],
      ["is:profile in:entry[type:unit]", "every profile inside a unit — the models' own profiles included, since the unit is above them too"],
      ["is:profile parent:entry[type:unit]", "only profiles placed directly on the unit. When placement is the question, parent/child, never in/has"],
      ["has*:  in*:  child*:  parent*:", "the same through links — a linked model counts as the unit's child; plain has/child never cross a link"],
      ["target:*[is:group]", "a link whose target matches"],
      ["refs:*[is:entryLink]", "something linking here matches"],
      ["mentions:*[is:condition scope:force]", "a condition or modifier naming it matches"],
      ["refs:0 mentions:0", "nothing links to it and nothing names it"],
      ["has:entry[has:profile[typeName:Weapon]]", "nesting"],
      ["parent:entry[type:unit child*:entry[type:model]]", "everything that must be true of the parent goes inside its brackets — here: it is a unit AND it directly contains models. As a sibling term, child*:entry would be asked of the profile instead"],
    ],
  },
  {
    title: "Saying it",
    sub: "English to operator",
    rows: [
      ["on X, directly under X, X's own", "parent:X[…]"],
      ["X contains / has (directly)", "child:X[…]  — child*: if the thing may be a link"],
      ["inside X, somewhere under X", "in:X[…]"],
      ["X contains (anywhere below)", "has:X[…]  — has*: through links"],
      ["linked to X, X's link", "target:X[…]"],
      ["used by, referenced by", "refs:*[…]  mentions:*[…]"],
    ],
  },
  {
    title: "Then",
    sub: "the second box, written a → b on this sheet: group the results",
    rows: [
      ["by:id", "group by a field; by:name,characteristics is a compound key, dotted paths work"],
      ["count:>1", "keep groups with that many nodes"],
      ["files:>1", "keep groups whose members come from that many files (pointless when catalogue is part of the key: then every group has one)"],
      ["sort:-count  sort:key  sort:files", "order; - for descending. Default: biggest group first"],
    ],
  },
];

const right: Group[] = [
  {
    title: "Keys",
    sub: "any attribute of a node works; these read something more useful than the raw value",
    list: true,
    rows: [
      ["is", "the kind — see Kinds"],
      ["name", "the name as stored"],
      ["label", "the name as the tree shows it, so conditions and constraints have one too"],
      ["id", "the id; on a link, its target's id matches as well"],
      ["comment", "the comment"],
      ["description", "a rule's or profile's text"],
      ["$text", "a characteristic's value"],
      ["characteristics", "all of a profile's characteristics as one line: AP=2; S=4"],
      ["logic", "a modifier, constraint or condition and everything under it as one line — group by it to find pasted copies"],
      ["kind", "the profile type's kind: model, weapon, spell, ability, rule, tag, summary"],
      ["type", "a constraint's min/max, a modifier's set/increment…, a condition's atLeast/instanceOf…, an entry's unit/model/upgrade"],
      ["scope childId field typeId targetId", "the id it holds — or, since ids resolve, the name of what it points at"],
      ["target", "what a link points at, by id or name"],
      ["catalogue", "the file it lives in"],
      ["key", "the array it sits in: selectionEntries, sharedProfiles, entryLinks…"],
      ["refs", "the links pointing at it"],
      ["textRefs", "how often other rules' and profiles' text names it — the auto-linked references, which refs/mentions cannot see; rules, profiles, categories and info groups are tracked"],
      ["textMentions", "the reverse: the names this node's own text uses — textMentions:Frenzy is everything whose text says Frenzy, and by:textMentions makes one group per mentioned name (a text naming three rules joins three groups)"],
      ["mentions", "the conditions and modifiers that name it in scope, childId or field"],
      ["shared", "sits in a shared array, or carries the shared flag"],
      ["link", "is a link"],
      ["collective collapsible flatten", "the effective flag, only on the kinds it applies to"],
      ["hidden import exportable", "the flag as stored; unset means the default"],
      ["error", "a diagnostic message on it"],
      ["value page typeName …", "anything else on the node, read as-is"],
    ],
  },
  {
    title: "Kinds",
    sub: "for is:, has:, in:, child:, parent:",
    list: true,
    icons: true,
    rows: [],
  },
  {
    title: "Recipes",
    rows: [
      ["id:any → by:id count:>1", "duplicate ids"],
      ["is:profile → by:name,characteristics count:>1", "duplicate profiles"],
      ["is:modifier → by:logic count:>1", "the same modifier and conditions, pasted around"],
      ["key:shared* refs:0 mentions:0", "unused shared things"],
      ["is:*link -target:*", "dead links"],
      ["is:profile kind:model parent:entry[type:unit child*:entry[type:model]]", "model stats on the unit instead of its models"],
      ["is:entry type:unit -has*:cost[value:>0]", "units with no cost anywhere"],
      ["is:entry hidden:true -child:modifier[field:hidden] -child:modifierGroup[has:modifier[field:hidden]]", "permanently hidden — no unhide modifier of its own, in a group or not"],
      ["comment:todo|fixme", "TODOs"],
    ],
  },
  {
    title: "In the box",
    screenOnly: true,
    rows: [
      ["Space, Enter", "turn a finished key:value into a pill; plain words stay as text. On the system search page Enter also runs the search"],
      ["Tab, ↑ ↓", "pick a suggestion"],
      ["click a pill", "edit it in place, with every value for its key on offer; + adds an | alternative; × removes it; Backspace on an empty box pulls the last one back"],
      ["click its operator", "the : or = on a pill opens a menu: contains, equals, not, greater, less…"],
      ["click away", "commits what was typed, like Enter"],
      ["Ctrl+A", "select the whole query, then Ctrl+C copies it or Backspace clears it"],
    ],
  },
];

const kindGroups: Array<[string, string[]]> = [
  ["tree", ["entry", "group", "categoryEntry", "forceEntry"]],
  ["info", ["profile", "rule", "infoGroup", "characteristic", "cost"]],
  ["logic", ["constraint", "condition", "conditionGroup", "localConditionGroup", "modifier", "modifierGroup", "repeat"]],
  ["types", ["profileType", "characteristicType", "costType", "publication"]],
  ["links — link is any of them", ["link", "entryLink", "groupLink", "categoryLink", "infoLink", "forceEntryLink", "catalogueLink"]],
  ["file", ["catalogue", "gameSystem"]],
];
/** Named after the target rather than the array; `is:infoLink` and `is:categoryLink` already cover them. */
const byTarget = new Set(["categoryEntryLink", "profileLink", "ruleLink", "infoGroupLink"]);
const listed = new Set(kindGroups.flatMap(([, list]) => list));
const kinds = [...kindGroups, ["other", isValues.filter((k) => !listed.has(k) && !byTarget.has(k))] as [string, string[]]];
right[1].rows = kinds.map(([group, list]) => [list.join(" "), group]);

/** The same sheet as Markdown, for pasting somewhere that cannot see the popup. */
function toMarkdown(): string {
  const out = ["# NR-Editor search syntax", "", intro, ""];
  for (const group of [...left, ...right]) {
    if (group.screenOnly) continue;
    out.push(`## ${group.title}${group.sub ? ` — ${group.sub}` : ""}`, "", "| example | meaning |", "| --- | --- |");
    for (const [example, meaning] of group.rows) {
      out.push(`| \`${example.replace(/\|/g, "\\|")}\` | ${meaning.replace(/\|/g, "\\|")} |`);
    }
    out.push("");
  }
  return out.join("\n");
}

export default defineComponent({
  emits: ["close"],
  data() {
    return { intro, left, right, copied: false };
  },
  methods: {
    icon(kind: string): string {
      return LONG_NAMES[kind] ?? kind;
    },
    async copy() {
      await navigator.clipboard.writeText(toMarkdown());
      this.copied = true;
      setTimeout(() => (this.copied = false), 1500);
    },
    /** Select-all and Ctrl+C gets the Markdown; a small selection copies as usual. */
    onCopy(e: ClipboardEvent) {
      const selected = getSelection()?.toString().length ?? 0;
      const whole = (e.currentTarget as HTMLElement).innerText.length;
      if (selected < whole * 0.8 || !e.clipboardData) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", toMarkdown());
    },
  },
});
</script>

<style lang="scss" scoped>
@use "@/shared_components/css/vars.scss" as *;

.help {
  font-size: 0.92em;
  line-height: 1.35;
  max-height: 78vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}
.top {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 10px;
  button {
    white-space: nowrap;
  }
}
.intro {
  margin: 0;
  flex: 1;
  opacity: 0.85;
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
}
section {
  border: 1px solid $box_border;
  border-radius: 4px;
  padding: 6px 10px 8px;
  margin-bottom: 10px;
}
h4 {
  margin: 0 0 4px;
  font-weight: bold;
  .sub {
    font-weight: normal;
    opacity: 0.7;
    margin-left: 6px;
  }
}
table {
  border-collapse: collapse;
  width: 100%;
  // Fixed: the columns split the card instead of the longest example deciding the split.
  table-layout: fixed;
}
tr:nth-child(even) {
  background-color: rgba(128, 128, 128, 0.08);
}
td {
  padding: 3px 8px 3px 4px;
  vertical-align: top;
  overflow-wrap: anywhere;
  &:first-child {
    width: 55%;
  }
  &.list code {
    display: inline-block;
    margin-right: 8px;
  }
  &.label {
    width: 52px;
    color: $gray;
  }
}
.kind {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-right: 10px;
  white-space: nowrap;
  .typeIcon {
    width: 14px;
    height: 14px;
  }
}
code {
  font-family: monospace;
  color: $blue;
}
</style>

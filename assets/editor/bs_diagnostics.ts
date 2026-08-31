/**
 * The default catalogue diagnostics.
 *
 * Adding a check used to mean finding the right spot in refreshErrors/addToIndex/
 * updateCondition/updateConstraint, then hand-pairing an addError with a matching
 * removeError on every path that could clear it. Miss one and the error sticks; call
 * removeErrors and you wipe checks that a different function owns.
 *
 * Here a rule answers one question about one node and returns a message or nothing.
 * bs_diagnostics_engine diffs that against what the node already carries, so nothing has
 * to remove anything, and a rule can only ever touch errors under its own id.
 *
 * To add a diagnostic: append one entry to DIAGNOSTICS, or call registerDiagnostic() from
 * outside. That is the whole procedure -- no piping, no cleanup.
 */
import { Condition, Constraint, basicQueryFields } from "~/assets/shared/battlescribe/bs_main";
import type { Link, LocalConditionGroup } from "~/assets/shared/battlescribe/bs_main";
import { splitScopeSelf, validScopes } from "~/assets/shared/battlescribe/bs_condition";
import { getModifierOrConditionParent } from "~/assets/shared/battlescribe/bs_modifiers";
import type { EditorBase, IErrorMessage } from "~/assets/shared/battlescribe/bs_main_catalogue";
import type { Diagnostic } from "./bs_diagnostics_engine";

export type { Diagnostic, DiagnosticContext, DiagnosticFinding, DiagnosticResult } from "./bs_diagnostics_engine";

const COMMENT_SEVERITY: Array<[string, IErrorMessage["severity"]]> = [
  ["todo:", "info"],
  ["warning:", "warning"],
  ["error:", "error"],
];

/** Entry kinds that only make sense when something links to them. */
const SHARED_KEYS = new Set([
  "sharedSelectionEntries",
  "sharedSelectionEntryGroups",
  "sharedProfiles",
  "sharedRules",
  "sharedInfoGroups",
  "sharedForceEntries",
  "sharedAssociations",
]);

/**
 * Whether a condition's `scope` names something it could actually be evaluated against.
 *
 * Lived in assets/shared until it was the last thing there needing EditorBase: it walks `refs`
 * to follow a node to whatever links at it, which only exists in the editor. Nothing in shared
 * called it -- bs_main_catalogue imported it and never used it.
 */
export function isScopeValid(parent: EditorBase, scope: string) {
  if (validScopes.has(splitScopeSelf(scope).base)) return true;
  const catalogue = parent.catalogue;
  const found = catalogue.findOptionById(scope);
  if (found) {
    if (found.isForce() && !parent.isForce()) return true;
    if (found.isCategory()) return true;
    if (found.isCatalogue()) return true;
  }
  const stack = [parent];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.id === scope) return true;
    if (current.parent) stack.push(current.parent);
    if (current.refs) stack.push(...current.refs);
  }
  return false;
}

export const DIAGNOSTICS: Diagnostic[] = [
  {
    id: "comment",
    applies: () => true,
    check(node) {
      const comment = node.comment === undefined ? "" : String(node.comment);
      for (const [prefix, severity] of COMMENT_SEVERITY) {
        if (comment.startsWith(prefix)) {
          return { msg: `${node.getName()}: ${comment}`, severity };
        }
      }
    },
  },

  {
    /**
     * A dead link, and where its id actually went.
     *
     * The id nearly always still exists -- in a catalogue this one does not import, because the
     * entry was copy-pasted from another faction's file and kept the source's targetId. Naming
     * that file turns "has no target" from a mystery into a one-line fix: either import it, or
     * repoint the link at the copy that is already reachable.
     */
    id: "no-target",
    severity: "error",
    applies: (node) => node.isLink(),
    check(node, ctx) {
      if (node.target) return;
      const base = `(${node.editorTypeName}) ${node.name} has no target`;
      const targetId = (node as EditorBase & Link).targetId;
      if (!targetId) return base;
      // Only runs for links that are already broken, so the global lookup costs nothing on the
      // catalogues where every link resolves.
      const elsewhere = ctx.findByIdGlobal(targetId) as EditorBase | undefined;
      const where = elsewhere?.getCatalogue?.();
      if (!where || where === ctx.catalogue) return base;
      return `${base}: id ${targetId} is in "${where.name}", which this catalogue does not import`;
    },
  },

  {
    id: "bad-link-target",
    severity: "error",
    applies: (node) => node.isLink(),
    check(node, ctx) {
      const link = node as EditorBase & Link;
      if (!link.targetId) return;
      // Answered from the system-wide cycle index rather than by walking up from this link;
      // see bs_link_cycles.ts for why. The message is unchanged: this is the same question.
      if (ctx.isCyclicLink(node)) {
        return "Link target cannot be itself or include itself as a child";
      }
      const target = ctx.findById(link.targetId) as EditorBase | undefined;
      if (target?.isLink()) return "Link target Cannot be a Link";
    },
  },

  {
    id: "no-profile-type",
    severity: "error",
    applies: (node) => node.isProfile() && !node.isLink(),
    check(node) {
      if (!(node as EditorBase & { typeId?: string }).typeId) return "Profile has no type";
    },
  },

  {
    id: "invalid-scope",
    severity: "error",
    applies: (node) => node instanceof Condition && Boolean(node.scope),
    check(node) {
      const condition = node as EditorBase & Condition;
      const parent = getModifierOrConditionParent(condition);
      if (parent && !isScopeValid(parent, condition.scope)) {
        return `Invalid scope ${condition.scope}`;
      }
    },
  },

  {
    id: "id-not-exist",
    severity: "warning",
    // Constraints reuse the Condition shape but have no childId to resolve.
    // instanceof first: editorTypeName is a getter that resolves through link targets, and
    // putting it in front ran it on every node of every catalogue for a rule that only ever
    // applies to conditions.
    applies: (node) =>
      node instanceof Condition && !(node instanceof Constraint) && node.editorTypeName !== "localConditionGroup",
    check(node, ctx) {
      const condition = node as EditorBase & Condition;
      const childId = condition.childId;
      if (!childId || basicQueryFields.has(childId)) return;
      const isInstanceOf = ["instanceOf", "notInstanceOf"].includes(condition.type);
      const target = isInstanceOf ? ctx.findByIdGlobal(childId) : ctx.findById(childId);
      if (!target) return "child id does not exist";
    },
  },

  {
    id: "duplicate-constraint-id",
    severity: "error",
    applies: (node) => node instanceof Constraint,
    check(node) {
      const siblings = node.parent?.constraintsIterator?.();
      if (!siblings) return;
      for (const found of siblings as Iterable<EditorBase & Constraint>) {
        if (found !== node && found.id === node.id) return "Duplicate constraints id";
      }
    },
    *related(node) {
      const siblings = node.parent?.constraintsIterator?.();
      if (siblings) yield* siblings as unknown as Iterable<EditorBase>;
    },
  },

  {
    /**
     * Replaces the old duplicate-id-1 / duplicate-id-2 pair. Those were asymmetric --
     * which node got which id depended on index insertion order -- and refreshErrors
     * cleared them wholesale, so they vanished until a reload. Asking "does anything
     * else hold my id" is answerable for one node at any time, so both sides report it
     * and both sides clear it on their own.
     */
    id: "duplicate-id",
    severity: "error",
    applies: (node) => Boolean(node.id),
    check(node, ctx) {
      const [other] = ctx.idCollisions(node);
      if (!other) return;
      const where = other.getCatalogue?.();
      return {
        msg: `Duplicate id ${node.id} ${other.getName()}`,
        other,
        extra: where && where !== ctx.catalogue ? where.name : undefined,
      };
    },
    related: (node, ctx) => ctx.idCollisions(node),
  },
];

/**
 * Shared entries exist to be linked to, so one nobody links to is usually a leftover from a
 * rename or a half-finished edit.
 *
 * Not registered by default. It accounted for 1000 of the 1023 diagnostics on Warhammer: The
 * Old World -- enough noise to bury the 23 that matter -- and it is the only rule whose answer
 * depends on a *different* node gaining a referrer, which is what forced processForEditor to
 * revalidate every id this catalogue points at after every load.
 *
 * `registerDiagnostic(UNUSED_DIAGNOSTIC)` turns it back on; note that doing so reintroduces the
 * staleness this rule needs that extra pass to avoid.
 */
export const UNUSED_DIAGNOSTIC: Diagnostic = {
  id: "unused",
  severity: "info",
  applies: (node) => SHARED_KEYS.has(node.parentKey),
  check(node) {
    if (node.refs?.length) return;
    return `${node.getName()} is not linked to by anything`;
  },
};

/**
 * Rules that exist, are correct, and are off because being correct is not the same as being
 * worth reporting. Kept reachable by name so a caller that genuinely wants one can ask for it
 * -- nr_diagnosis runs these on request without registering them, so nothing is written to the
 * node and the editor's own error list is untouched.
 */
export const OPTIONAL_DIAGNOSTICS: Diagnostic[] = [UNUSED_DIAGNOSTIC];

/** Every rule addressable by id, registered or not. */
export function diagnosticById(id: string): Diagnostic | undefined {
  return [...DIAGNOSTICS, ...OPTIONAL_DIAGNOSTICS].find((rule) => rule.id === id);
}

/** Scopes that aren't node ids don't need resolving; exported so callers can share the set. */
export { validScopes };

/** Adds a rule at runtime. Rules are plain objects, so a plugin needs nothing else. */
export function registerDiagnostic(rule: Diagnostic): void {
  const at = DIAGNOSTICS.findIndex((o) => o.id === rule.id);
  if (at >= 0) DIAGNOSTICS[at] = rule;
  else DIAGNOSTICS.push(rule);
}

/**
 * Drops a rule again, for when the script that added it is reloaded or removed.
 *
 * The engine can only clear ids of rules it still runs, so whatever this rule already wrote
 * on a node stays there: the caller has to pass the returned rule to clearDiagnostics() on
 * the nodes it may have touched. scriptsStore.revalidate_system does both in one walk.
 */
export function unregisterDiagnostic(id: string): Diagnostic | undefined {
  const at = DIAGNOSTICS.findIndex((o) => o.id === id);
  return at >= 0 ? DIAGNOSTICS.splice(at, 1)[0] : undefined;
}

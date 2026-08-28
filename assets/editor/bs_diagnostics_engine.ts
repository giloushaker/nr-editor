/**
 * The diagnostics engine: runs rules against a node and reconciles the result.
 *
 * Deliberately free of imports of any kind: the shapes it needs are declared below and
 * everything else arrives through DiagnosticContext. That keeps it out of the import cycle
 * and lets it be compiled and exercised on its own -- see bs_diagnostics_check.ts,
 * runnable with `npm run check:diagnostics`.
 */

/**
 * The engine only ever reads these fields and calls these two methods, so it declares the
 * shape it needs instead of importing EditorBase/Catalogue. That is what keeps this file
 * free of runtime *and* type dependencies, so it compiles and runs on its own. The index
 * signature makes the real types assignable in both directions.
 */
export interface DiagnosticNode {
  editorTypeName?: string;
  errors?: DiagnosticError[];
  getCatalogue?(): DiagnosticHost | undefined;
  [key: string]: any;
}

export interface DiagnosticError {
  id?: string;
  msg: string;
  severity?: "error" | "warning" | "info" | "debug";
  source?: any;
  other?: any;
  extra?: string;
}

export interface DiagnosticHost {
  addError(node: any, error: DiagnosticError & { id: string }): void;
  removeError(node: any, id: string, event?: boolean): void;
  [key: string]: any;
}

/** What a rule may reach that lives outside the leaf modules. */
export interface DiagnosticContext {
  catalogue: DiagnosticHost;
  /** Resolve an id in this catalogue and its imports. */
  findById(id: string): any | undefined;
  /** Resolve an id anywhere in the system (used by instanceOf conditions). */
  findByIdGlobal(id: string): any | undefined;
  /** Whether `id` names a node this one could sit under, following links. */
  hasPossibleParent(node: DiagnosticNode, id: string): boolean;
  /** Other nodes holding the same id, in whichever scope the settings say counts. */
  idCollisions(node: DiagnosticNode): DiagnosticNode[];
}

export interface DiagnosticFinding {
  msg: string;
  severity?: DiagnosticError["severity"];
  /** The other node involved, for diagnostics about a pair. */
  other?: any;
  extra?: string;
}

/** A message, or nothing when the node is fine. */
export type DiagnosticResult = string | DiagnosticFinding | undefined | null | void;

export interface Diagnostic {
  /** Namespace for this rule's errors. A rule can only add or clear its own id. */
  id: string;
  severity?: DiagnosticError["severity"];
  /** Cheap gate; unrelated nodes skip check() entirely. */
  applies(node: any): boolean;
  check(node: any, ctx: DiagnosticContext): DiagnosticResult;
  /**
   * Nodes whose verdict may flip because this one changed -- a duplicate id stops being
   * duplicate for the other node too. The engine revalidates these once, without recursing.
   */
  related?(node: any, ctx: DiagnosticContext): Iterable<DiagnosticNode>;
}

const NO_ERRORS = Object.freeze([]) as unknown as DiagnosticError[];
/** Nearly every node has no related nodes; sharing one empty iterable skips a Set per call. */
const NO_RELATED: ReadonlySet<DiagnosticNode> = new Set();

/**
 * Vue's reactive Maps normalised keys with toRaw, so a node stored through one proxy was found
 * through any other. `byNode` is a plain Map now -- the store is markRaw'd, because a node's
 * errors are read once per rule per revalidation and a proxy trap there costs more than the
 * check -- so the normalisation has to happen here, or the same node under two proxies keeps
 * two separate error lists and neither one ever clears the other's.
 *
 * Written inline rather than imported to keep this module dependency-free.
 */
function raw<T>(node: T): T {
  return (node as { __v_raw?: T } | null)?.__v_raw ?? node;
}

/**
 * Where diagnostics actually live.
 *
 * They used to be kept twice: an array on each node and a flat copy on the catalogue, both
 * appended and spliced by hand. Clearing one error meant an indexOf + splice over the whole
 * catalogue list, so a full revalidation pass was quadratic -- and the two copies could
 * disagree.
 *
 * Here a node's errors are keyed by node and the catalogue-wide view is derived. Severity
 * counts are maintained as errors come and go, so the badge never walks the list, and the
 * flat list is built only when something actually asks for it.
 */
export class DiagnosticStore<TNode = any> {
  private byNode = new Map<TNode, DiagnosticError[]>();
  private counts: Record<string, number> = {};
  private version = 0;
  private flat?: { version: number; list: DiagnosticError[] };

  /**
   * Bumped on every mutation. The store is markRaw'd, so Vue cannot see it change; the editor
   * hooks this to a reactive token instead. Unset outside the editor, so it costs one
   * undefined check.
   */
  onChange?: () => void;

  /** Errors on one node. Live and shared -- read it, don't mutate it. */
  for(node: TNode): DiagnosticError[] {
    return this.byNode.get(raw(node)) ?? NO_ERRORS;
  }

  private tally(error: DiagnosticError, by: number): void {
    const severity = error.severity || "error";
    this.counts[severity] = (this.counts[severity] || 0) + by;
    this.version++;
    this.onChange?.();
  }

  /**
   * Sets or clears the error a rule owns on a node. Returns whether anything changed, so
   * callers can skip work when a rule keeps reporting the same thing.
   */
  set(node: TNode, id: string, error: DiagnosticError | undefined): boolean {
    const key = raw(node);
    const list = this.byNode.get(key);
    const at = list ? list.findIndex((o) => o.id === id) : -1;
    const existing = at >= 0 ? list![at] : undefined;

    if (!error) {
      if (!existing) return false;
      list!.splice(at, 1);
      if (!list!.length) this.byNode.delete(key);
      this.tally(existing, -1);
      return true;
    }

    const next = { ...error, id };
    if (existing) {
      if (existing.msg === next.msg && existing.severity === next.severity) return false;
      list![at] = next;
      this.tally(existing, -1);
      this.tally(next, 1);
      return true;
    }

    if (list) list.push(next);
    else this.byNode.set(key, [next]);
    this.tally(next, 1);
    return true;
  }

  /** Drops every error on a node -- used when it leaves the tree. */
  clear(node: TNode): boolean {
    const key = raw(node);
    const list = this.byNode.get(key);
    if (!list?.length) return false;
    for (const error of list) this.tally(error, -1);
    this.byNode.delete(key);
    return true;
  }

  /** O(1): maintained as errors come and go, so a badge never walks the list. */
  count(severity?: DiagnosticError["severity"]): number {
    if (severity) return this.counts[severity] || 0;
    let total = 0;
    for (const key in this.counts) total += this.counts[key];
    return total;
  }

  /** The catalogue-wide list, materialised only when asked and cached until something moves. */
  all(): DiagnosticError[] {
    if (this.flat?.version === this.version) return this.flat.list;
    const list: DiagnosticError[] = [];
    for (const errors of this.byNode.values()) list.push(...errors);
    this.flat = { version: this.version, list };
    return list;
  }

  /** Forgets every node the predicate matches -- used when a catalogue unloads. */
  purge(matches: (node: TNode) => boolean): void {
    for (const node of [...this.byNode.keys()]) if (matches(node)) this.clear(node);
  }
}

function normalize(rule: Diagnostic, result: DiagnosticResult): DiagnosticFinding | undefined {
  if (!result) return undefined;
  const finding = typeof result === "string" ? { msg: result } : result;
  return { ...finding, severity: finding.severity ?? rule.severity };
}

/**
 * Re-evaluates one node against every applicable rule and reconciles its errors.
 *
 * `cascade` is what lets pair diagnostics settle: after checking this node the engine
 * revalidates whatever each rule names as related, once, with cascade off. One level is
 * enough because relatedness here is symmetric, and it bounds the work a rule can cause.
 */
export function runDiagnostics(
  node: DiagnosticNode,
  ctx: DiagnosticContext,
  rules: Diagnostic[],
  cascade = true,
): void {
  let alsoCheck: Set<DiagnosticNode> | undefined;

  /**
   * Read once, not once per rule. `node.errors` is an accessor over the catalogue's store, and
   * a full load runs every rule over every node -- nine reads per node was most of the engine's
   * cost. Safe to reuse across the loop: a rule only ever adds or clears its *own* id, so the
   * only thing this snapshot can miss is an entry another rule added during this same call,
   * which no later rule looks for. Additions are still exact, because DiagnosticStore.set
   * reconciles against the live list.
   */
  const errors = node.errors;

  for (const rule of rules) {
    let finding: DiagnosticFinding | undefined;
    let applies: boolean;
    try {
      applies = rule.applies(node);
      finding = applies ? normalize(rule, rule.check(node, ctx)) : undefined;
    } catch (e) {
      // A broken rule must not take the rest of the diagnostics down with it.
      console.error(`Diagnostic "${rule.id}" threw on ${node.editorTypeName}`, e);
      continue;
    }

    const existing = errors?.find((o) => o.id === rule.id);
    if (!finding) {
      if (existing) ctx.catalogue.removeError(node, rule.id);
    } else if (!existing || existing.msg !== finding.msg || existing.severity !== finding.severity) {
      ctx.catalogue.addError(node, {
        id: rule.id,
        source: node,
        msg: finding.msg,
        severity: finding.severity,
        other: finding.other,
        extra: finding.extra,
      });
    }

    if (cascade && applies && rule.related) {
      try {
        for (const other of rule.related(node, ctx)) {
          if (other !== node) (alsoCheck ||= new Set<DiagnosticNode>()).add(other);
        }
      } catch (e) {
        console.error(`Diagnostic "${rule.id}" related() threw on ${node.editorTypeName}`, e);
      }
    }
  }

  for (const other of alsoCheck ?? NO_RELATED) {
    const otherCatalogue = other.getCatalogue?.() ?? ctx.catalogue;
    const otherCtx = otherCatalogue === ctx.catalogue ? ctx : { ...ctx, catalogue: otherCatalogue };
    runDiagnostics(other, otherCtx, rules, false);
  }
}

/** Clears every diagnostic the given rules own from a node -- used when it leaves the tree. */
export function clearDiagnostics(node: DiagnosticNode, catalogue: DiagnosticHost, rules: Diagnostic[]): void {
  if (!node.errors?.length) return;
  for (const rule of rules) {
    if (node.errors?.some((o) => o.id === rule.id)) catalogue.removeError(node, rule.id);
  }
}

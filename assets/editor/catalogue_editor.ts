/**
 * Everything the editor adds to a Catalogue: diagnostics, the reverse reference index,
 * revalidation, duplicate-id claims, and the per-node `parentKey`/`editorTypeName` prototype.
 *
 * This all used to live in assets/shared, which is a submodule the roster app (nuxt-nr) also
 * builds from. It read none of it and paid for all of it -- most expensively in addToIndex,
 * which built a reverse index of every reference in every catalogue it loaded. Worse, the
 * `refs` accessor below sits on Base.prototype and collides with processForWiki, which does
 * `addObjUnique(node, "refs", parent)` on the same key; over there `refs` has to stay a plain
 * own property, and now it is.
 *
 * The methods stay on Catalogue.prototype under their existing names because roughly two
 * hundred call sites reach them that way -- including scripts data devs have already written,
 * which we do not get to break.
 *
 * Import this module for its side effects before any catalogue is loaded; plugins/vue_init.ts
 * and stores/editorStore.ts both do, and both run at module-eval time.
 */
import {
  Base,
  Condition,
  Constraint,
  Link,
  arrayKeys,
  forEachObjectWhitelist2,
} from "~/assets/shared/battlescribe/bs_main";
import {
  Catalogue,
  resolveId,
  type EditorBase,
  type IErrorMessage,
} from "~/assets/shared/battlescribe/bs_main_catalogue";
import { onSetPrototype } from "~/assets/shared/battlescribe/bs_main_types";
import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import { addObjUnique, popObj } from "~/assets/shared/battlescribe/bs_helpers";
import type { BSCatalogueManager } from "~/assets/shared/battlescribe/bs_system";
import { markRaw, shallowRef } from "vue";
import { DIAGNOSTICS } from "./bs_diagnostics";
import { DiagnosticStore, runDiagnostics, type DiagnosticContext } from "./bs_diagnostics_engine";
import { ReferenceIndex } from "./bs_reference_index";
import { CycleIndex } from "./bs_link_cycles";
import type { entries, types } from "~/assets/shared/battlescribe/entries";
import { outgoingReferences } from "./bs_references";
import { getName, getTypeName } from "./bs_editor";

/**
 * The reverse index and the diagnostic store are kept out of Vue's reactive graph.
 *
 * They used to be plain fields on the catalogue, so Vue made them reactive along with
 * everything else -- their Maps included. That is fine for something read now and then, and
 * ruinous here: a full load of Warhammer: The Old World reads `node.refs` 1.5 million times,
 * and through a reactive Map each read costs a proxy trap on the catalogue, another on the
 * manager, another on the Map, and a `toReactive` wrap of every node handed back. Measured at
 * ~3us a read against ~44ns for a plain property -- close to four seconds of a six-second load.
 *
 * markRaw fixes the cost and breaks the UI, because Vue can no longer see either store change.
 * This token puts that back: the accessors below read it, the stores bump it when they mutate,
 * and one microtask collapses a whole load's worth of bumps into a single notification.
 *
 * ponytail: one token for both stores, so any change redraws anything reading errors or refs.
 * Per-catalogue tokens if a big catalogue ever feels sluggish while typing.
 */
const revision = shallowRef(0);
let pending = false;
let counter = 0;
function bump(): void {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    revision.value = ++counter;
  });
}

/** Takes a store out of the reactive graph and points its change hook at the token. */
function tracked<T extends { onChange?: () => void }>(store: T): T {
  markRaw(store);
  store.onChange = bump;
  return store;
}

/**
 * `parentKey` -- which array a node was found in -- is the editor's whole notion of what a
 * node *is*; the data itself only records position.
 *
 * It is a non-enumerable own property, so it stays out of `Object.keys`, spreads and clones
 * exactly as the accessor it replaces did, and out of saved files (entryToJson works from the
 * `goodJsonKeys` allow-list, which it is not in).
 *
 * What it replaces: a class generated per parentKey, grafted onto every node with a *second*
 * `setPrototypeOf` -- 42k extra prototype swaps on a full load of this system, each one a
 * shape change. Its cache was keyed on parentKey alone when the honest key was
 * (parentKey, base prototype), and a `Link.prototype.keyInfoCache` override existed to give
 * links a separate cache rather than fix the key. One own property needs none of that.
 */
onSetPrototype((obj, key) => {
  Object.defineProperty(obj, "parentKey", { value: key, writable: true, configurable: true });
});

/**
 * Derived from parentKey, and from the link target's own type when there is one, so it stays
 * correct if a link is retargeted. Was regenerated per key by the machinery above; one getter
 * on Base does the same job.
 */
Object.defineProperty(Base.prototype, "editorTypeName", {
  get(this: Base) {
    if (this.parentKey === undefined) return undefined;
    // getTypeName hands back the key unchanged when it does not know it, so any string is safe.
    return getTypeName(this.parentKey as Parameters<typeof getTypeName>[0], this);
  },
  configurable: true,
});

Base.prototype.toString = function (this: Base): string {
  return `${this.editorTypeName} - ${getName(this)}`;
};

/**
 * Nodes this one could sit under, following links upward. Used by the invalid-scope
 * diagnostic and by the query editor to offer scopes that can actually match.
 */
function startOfWalk(node: EditorBase): EditorBase[] | undefined {
  if (node.isCatalogue()) return undefined;
  // Read once: `refs` is an accessor over the reference index, and this walk is the heaviest
  // reader of it in the editor.
  const refs = node.refs;
  if (!node.parent && !refs?.length) return undefined;
  return [node.parent, ...(refs ?? [])].filter(Boolean) as EditorBase[];
}

/**
 * Every node `node` could sit under, innermost first -- the scope dropdown's list.
 *
 * Walks upward through parents and through whatever links to each node on the way. The
 * bad-link-target diagnostic used to ask this same question per link and search the result for
 * one id; that is bs_link_cycles.ts now, which answers it for the whole system at once. This is
 * the remaining caller, and it runs for a single node when the query editor opens, so the walk
 * is fine as it stands.
 */
export function getAllPossibleParents(node: EditorBase) {
  const result = [] as EditorBase[];
  const refsStack = startOfWalk(node);
  if (!refsStack) return result;
  let temp = [] as EditorBase[];
  const stack = [] as EditorBase[];
  const set = new Set();
  while (refsStack.length) {
    stack.push(refsStack.shift()!);
    temp = [];
    while (stack.length) {
      const cur = stack.pop()!;
      if (set.has(cur.id)) continue;
      set.add(cur.id);
      temp.push(cur);
      if (cur.parent && !cur.parent.isCatalogue()) stack.push(cur.parent);
      const refs = cur.refs;
      if (refs?.length) refsStack.push(...refs);
    }
    result.push(...temp.reverse());
  }
  return result.filter((o) => o.editorTypeName !== "catalogueLink");
}

/**
 * The system's link cycles, rebuilt when the links move.
 *
 * Held on the manager, like the reference index, because a cycle can run through catalogues:
 * a shared entry in one, linked from another that it links back into. Built lazily and only
 * when something has actually changed, so an edit that touches no link costs nothing.
 */
function cycleIndexFor(catalogue: Catalogue): CycleIndex<EditorBase> {
  const owner = (catalogue.manager ?? catalogue) as {
    cycles?: CycleIndex<EditorBase>;
    cyclesDirty?: boolean;
  };
  if (owner.cycles && !owner.cyclesDirty) return owner.cycles;
  const references = catalogue.references;
  owner.cycles = CycleIndex.build<EditorBase>({
    // Everything that points at anything, narrowed to links: a condition's childId cannot
    // expand into a tree, so it cannot be part of a loop.
    links: (function* () {
      for (const node of references.sources()) if (node.isLink()) yield node;
    })(),
    parentOf: (node) => {
      const parent = node.parent;
      return parent && !parent.isCatalogue() ? parent : undefined;
    },
    referrersOf: (node) => references.referrers(node.id, "link"),
  });
  owner.cyclesDirty = false;
  return owner.cycles;
}

/** Called when a link moves; the next question rebuilds. */
function invalidateCycles(catalogue: Catalogue): void {
  const owner = (catalogue.manager ?? catalogue) as { cyclesDirty?: boolean };
  owner.cyclesDirty = true;
}

/**
 * The editor half of Catalogue, written as a class so `this` is properly typed, then copied
 * onto Catalogue.prototype. The signatures are repeated in the `declare module` block at the
 * bottom; that duplication is checked by the compiler, because this class extends Catalogue
 * and so has to match whatever the augmentation declares.
 */
class CatalogueEditor extends Catalogue {
  /**
   * Catalogues are JSON with a prototype grafted on, never `new`-ed, so class field
   * initializers never run on them: anything declared `x = {}` here is undefined at runtime.
   * These are lazy accessors for that reason -- do not turn them back into initialized fields.
   *
   * idClaims is id -> every node claiming it, recorded only once an id is claimed more than
   * once. `index` keeps a single node per id, so without this the duplicate-id check could
   * only fire at insertion time -- which is why it used to depend on insertion order and
   * never came back once cleared. Collisions are rare, so this stays near-empty.
   */
  private ownIdClaims?: Record<string, EditorBase[]>;

  get idClaims(): Record<string, EditorBase[]> {
    return (this.ownIdClaims ||= {});
  }

  /**
   * Depth counter, not a boolean: bulk operations nest (a load inside a reload), and a
   * boolean would let the inner one switch revalidation back on halfway through. See
   * idClaims for why it is not initialized here.
   */
  declare revalidationSuspended?: number;

  /**
   * Fallback for a catalogue with no manager. References are system-wide -- a link in one
   * catalogue points at a shared entry in another -- so the manager owns the real index.
   */
  private ownReferences?: { owner: unknown; index: ReferenceIndex<EditorBase> };

  /**
   * Errors are keyed by node here rather than duplicated into an array on the catalogue and
   * another on every node. Per-catalogue because that is the scope the UI reports on.
   */
  private ownDiagnostics?: DiagnosticStore<EditorBase>;

  get diagnostics(): DiagnosticStore<EditorBase> {
    return (this.ownDiagnostics ||= tracked(new DiagnosticStore<EditorBase>()));
  }

  /**
   * Every diagnostic in this catalogue. Derived, not stored -- built on demand and cached
   * until something changes, so nothing has to keep a second copy in step.
   */
  get errors(): IErrorMessage[] {
    void revision.value;
    return this.diagnostics.all() as IErrorMessage[];
  }

  /** O(1); the tree badge asks for this on every render. */
  errorCount(severity?: IErrorMessage["severity"]): number {
    void revision.value;
    return this.diagnostics.count(severity);
  }

  /**
   * Cached per owning manager rather than looked up each time: this is read on the way to
   * every `refs` access, and walking catalogue -> manager -> references is three reactive
   * property reads. The cache is keyed on the manager so `reload(otherManager)` cannot keep
   * handing back the previous system's index.
   */
  get references(): ReferenceIndex<EditorBase> {
    const manager = this.manager as ({ references?: ReferenceIndex<EditorBase> } & object) | undefined;
    const cached = this.ownReferences;
    if (cached && cached.owner === manager) return cached.index;
    const index = manager
      ? (manager.references ||= tracked(new ReferenceIndex<EditorBase>()))
      : tracked(new ReferenceIndex<EditorBase>());
    this.ownReferences = { owner: manager, index };
    return index;
  }

  /**
   * Revalidates every node holding `id`.
   *
   * Ids are unique per catalogue at best: shared entries get copied between catalogues
   * keeping their id, and a link resolves to whichever copy its own catalogue reaches first.
   * A referrer moving changes the answer for all of them, so resolving to a single node left
   * the others reporting a verdict about references that were never theirs.
   *
   * Falls back to the system-wide map for a target in a catalogue this one does not import.
   * Missing ids are normal (a broken link) and cost nothing.
   */
  private revalidateId(id: string, skip?: Catalogue): void {
    let found = false;
    for (const index of this.getIndexes()) {
      const node = index[id] as EditorBase | undefined;
      if (!node) continue;
      found = true;
      if (node.catalogue !== skip) node.catalogue?.revalidate(node);
    }
    if (found) return;
    const global = this.manager?.index?.[id] as EditorBase | undefined;
    if (global && global.catalogue !== skip) global.catalogue.revalidate(global);
  }

  /**
   * Records what `node` points at and revalidates whatever that changed.
   *
   * The targets are looked up only to revalidate them; indexing itself never resolves, so a
   * reference to a catalogue that hasn't loaded is kept and starts counting when it arrives.
   */
  reindexReferences(node: EditorBase) {
    const affected = this.references.set(node, outgoingReferences(node));
    // Only a link that actually moved reshapes the cycle graph. Guarding on the change report
    // matters more than it looks: the validation pass re-resolves every link to the target it
    // already had, and invalidating there would rebuild the index once per link.
    if (affected.length && node.isLink()) invalidateCycles(this);
    for (const id of affected) this.revalidateId(id);
  }

  unindexReferences(node: EditorBase) {
    for (const id of this.references.remove(node)) this.revalidateId(id);
  }

  removeFromIndex(cur: EditorBase) {
    invalidateCycles(this);
    if (cur.id && $toRaw(this.index[cur.id]) === $toRaw(cur)) {
      delete this.index[cur.id];
    }
    if (cur.id && this.manager?.index && $toRaw(this.manager.index[cur.id]) === $toRaw(cur)) {
      delete this.manager.index[cur.id];
    }
    this.releaseId(cur);
    this.removeErrors(cur);
    this.unindexReferences(cur);
    // Whatever pointed here now dangles: drop the resolved target and let the diagnostics
    // report it. Iterated over a copy, since revalidating may reindex.
    for (const ref of [...cur.refs]) {
      delete (ref as Partial<Link>).target;
      ref.catalogue?.refreshErrors(ref);
    }
    for (const ref of [...cur.other_refs]) {
      ref.catalogue?.refreshErrors(ref, true);
    }
  }

  processForEditor() {
    if (this.loaded_editor) return;
    this.loaded_editor = true;
    // init() indexes every node, and indexing tells everything that referred to it to
    // re-resolve and re-check itself. Links still get resolved under this -- only the rule
    // runs are skipped -- and the pass at the bottom of this method covers every node once,
    // so all of that work was being thrown away.
    this.withoutRevalidation(() => this.init(false));

    // Records `parent` and the outgoing edges of nodes init() could not reach: addToIndex
    // returns early on a node with no id, so conditions and modifiers -- which carry childId,
    // scope and value edges -- are indexed here, and nothing sets `parent` at all.
    this.withoutRevalidation(() => {
      forEachObjectWhitelist2<EditorBase>(
        this,
        (cur, parent) => {
          // Guarded because these are writes through a Vue proxy, on every node of every
          // catalogue: a reload re-walks a tree whose parents have not moved, and a read that
          // finds the value already correct is far cheaper than a set that re-triggers.
          if (cur.parent !== parent) cur.parent = parent;
          if (cur.catalogue !== this) cur.catalogue = this;
          this.references.set(cur, outgoingReferences(cur));
        },
        arrayKeys,
      );
    });
    forEachObjectWhitelist2<EditorBase>(this, (cur) => (cur.isLink() ? this.updateLink(cur) : this.refreshErrors(cur)), arrayKeys);

    // This catalogue now *provides* every id in its index, so anything elsewhere that was
    // waiting on one has a different answer too. onIndexed normally tells them one node at a
    // time, but it was suspended for the load above, and their own catalogue has already had
    // its pass -- without this, a condition pointing into a catalogue that loads later keeps a
    // "child id does not exist" it no longer deserves. Referrers inside this catalogue are
    // already covered by the pass above.
    //
    // The mirror of this -- revalidating every id this catalogue *points at*, because those
    // targets just gained a referrer -- is gone with the unused rule, which was the only one
    // whose verdict a new referrer could change.
    for (const id in this.index) {
      for (const referrer of this.references.referrers(id, "link")) {
        if (referrer.catalogue !== this) referrer.catalogue?.revalidate(referrer);
      }
      for (const referrer of this.references.referrers(id, "other")) {
        if (referrer.catalogue !== this) referrer.catalogue?.revalidate(referrer);
      }
    }
  }

  async reload(manager: BSCatalogueManager = this.manager) {
    delete this.initialized;
    delete this.loaded;
    delete this.loaded_editor;
    const refs = (this as Base as EditorBase).refs;
    delete (this as Partial<Catalogue>).index;
    const key = this.isGameSystem() ? "gameSystem" : "catalogue";
    const loaded = await manager.loadData({ [key]: this } as any);
    this.processForEditor();
    if (refs) {
      for (const ref of refs) {
        if (ref.editorTypeName === "catalogueLink") await ref.catalogue?.reload(manager);
      }
    }
    return loaded;
  }

  /**
   * Kept as the API scripts and rules call; the storage behind it is the diagnostic store.
   * An error is owned by the node's own catalogue, so a cross-catalogue check writes it once
   * rather than into both catalogues' lists.
   */
  addError(obj: EditorBase, newError: IErrorMessage & { id: string }) {
    (obj.catalogue ?? this).diagnostics.set(obj, newError.id, newError);
  }

  removeError(obj: EditorBase, id: string) {
    (obj.catalogue ?? this).diagnostics.set(obj, id, undefined);
  }

  /** Drops every diagnostic on a node, for when it leaves the tree. */
  removeErrors(obj: EditorBase) {
    if (obj instanceof Constraint) {
      obj.catalogue?.revalidateConstraintSiblings(obj as Constraint & EditorBase);
    }
    (obj.catalogue ?? this).diagnostics.clear(obj);
  }

  private ownDiagnosticContext?: DiagnosticContext;

  /**
   * Everything a diagnostic may reach that lives on the catalogue rather than a leaf module.
   *
   * Built once. It is a pure function of `this`, and it was being rebuilt -- an object and five
   * closures -- on every one of the ~140k revalidations a load performs. markRaw keeps it out
   * of the reactive graph, so reading a field off it inside a rule is not a proxy trap.
   */
  diagnosticContext(): DiagnosticContext {
    if (this.ownDiagnosticContext) return this.ownDiagnosticContext;
    return (this.ownDiagnosticContext = markRaw({
      catalogue: this,
      findById: (id) => resolveId(id, this.getIndexes()),
      findByIdGlobal: (id) => this.findOptionByIdGlobal(id) as Base | undefined,
      isCyclicLink: (node) => cycleIndexFor(this).sameComponent(node as EditorBase, (node as Partial<Link>).target as EditorBase),
      idCollisions: (node) => this.idCollisions(node as EditorBase),
    }));
  }

  /**
   * Single entry point for "this node may have changed, re-check it".
   * Callers no longer add or clear individual errors: rules in bs_diagnostics own their
   * ids, and the engine reconciles.
   */
  revalidate(cur: EditorBase) {
    if (this.revalidationSuspended || this.manager?.revalidationSuspended) return;
    runDiagnostics(cur, this.diagnosticContext(), DIAGNOSTICS);
  }

  /**
   * Runs `fn` without per-node revalidation, for bulk work that would otherwise re-run every
   * rule once per reference it wires up. The caller is responsible for a validation pass
   * afterwards -- processForEditor already ends with one.
   */
  withoutRevalidation<T>(fn: () => T): T {
    // Held on the manager when there is one: indexing a node notifies referrers in *other*
    // catalogues, and each of those checks its own flag. Suspending only this catalogue left
    // every cross-catalogue referrer revalidating anyway, which during a load is most of them.
    const owner = (this.manager ?? this) as { revalidationSuspended?: number };
    owner.revalidationSuspended = (owner.revalidationSuspended || 0) + 1;
    try {
      return fn();
    } finally {
      owner.revalidationSuspended = (owner.revalidationSuspended || 1) - 1;
    }
  }

  /** Other nodes claiming this node's id, in whichever scope the settings make relevant. */
  idCollisions(cur: EditorBase): EditorBase[] {
    const claims = this.manager?.settings?.globalDuplicateIdError ? this.manager.idClaims : this.idClaims;
    const found = claims?.[cur.id];
    if (!found?.length) return [];
    return found.filter((o) => o !== cur && o.id === cur.id && (cur.isIdUnique() || o.isIdUnique()));
  }

  /**
   * Records a collision so either side can answer the duplicate-id check later.
   *
   * `previous` is whoever held this id in the catalogue index immediately before `cur` took
   * it -- addToIndex passes it in rather than leaving this to read the index afterwards and
   * find `cur` looking back at it.
   */
  claimId(cur: EditorBase, previous?: EditorBase) {
    const global = this.manager?.settings?.globalDuplicateIdError;
    const claims = global ? this.manager.idClaims : this.idClaims;
    const existing = global ? (this.manager.index?.[cur.id] as EditorBase | undefined) : previous;
    if (existing && existing !== cur && claims) {
      addObjUnique(claims, cur.id, existing);
      addObjUnique(claims, cur.id, cur);
      this.revalidate(existing);
    }
  }

  releaseId(cur: EditorBase) {
    for (const claims of [this.idClaims, this.manager?.idClaims]) {
      const found = claims?.[cur.id];
      if (!found) continue;
      popObj(claims, cur.id, cur);
      for (const other of [...(claims[cur.id] || [])]) other.catalogue?.revalidate(other);
      if ((claims[cur.id]?.length || 0) < 2) delete claims[cur.id];
    }
  }

  /**
   * Keeps the unresolved-link bookkeeping in step. This is index maintenance, not
   * validation -- the "has no target" message itself comes from the diagnostics registry.
   */
  refreshErrors(cur: EditorBase, _deleted = false) {
    if (cur instanceof Condition) this.updateRefsForCondition(cur);
    this.revalidate(cur);
  }

  updateLink(link: Link & EditorBase) {
    const target = resolveId(link.targetId, this.getIndexes()) as EditorBase;
    link.target = target;
    if (link.target) {
      link.name = target.name;
      const targetType = (link.target as EditorBase).editorTypeName;
      if (targetType == "categoryEntry") {
        delete link.type;
      } else {
        link.type = targetType;
      }
    }
    // refs are derived from targetId, so retargeting is one call, and it reports the old
    // target as well as the new one.
    this.reindexReferences(link);
    this.refreshErrors(link);
    return link.target !== undefined;
  }

  /**
   * Re-checks a constraint's siblings once it has left the tree.
   *
   * Only needed for removal: while the constraint is still present, revalidate() covers the
   * siblings on its own, because the duplicate-constraint-id rule names them as related and
   * the engine cascades. Sweeping them here as well ran every rule on every sibling twice.
   */
  revalidateConstraintSiblings(constraint: Constraint & EditorBase) {
    for (const found of (constraint.parent?.constraintsIterator() || []) as Iterable<Constraint & EditorBase>) {
      if (found === constraint) continue;
      found.catalogue?.revalidate(found);
    }
  }

  /**
   * Kept as the name other files call; the reference bookkeeping it used to do by hand is
   * now derived from the condition's own fields.
   */
  updateRefsForCondition(condition: EditorBase) {
    this.reindexReferences(condition);
  }

  /** Kept for callers outside this file (right panel fields, bs_editor). */
  updateCondition(condition: EditorBase, _previousField?: string) {
    this.updateRefsForCondition(condition);
    this.revalidate(condition);
  }

  unlinkLink(link: Link & EditorBase) {
    this.references.remove(link);
    invalidateCycles(this);
  }

  /**
   * Drops everything the editor derived for this catalogue, so an unload leaves nothing
   * behind. Separate from the shared reset() because none of this exists over there.
   */
  resetEditorState() {
    this.ownDiagnostics = undefined;
    this.ownDiagnosticContext = undefined;
    this.ownReferences = undefined;
    this.ownIdClaims = undefined;
  }
}

/**
 * Captured before the graft below replaces it. `super.unloadAll()` would not work: the graft
 * copies onto GameSystemFiles.prototype itself, which is exactly what `super` resolves to, so
 * the override would call itself.
 */
const baseUnloadAll = GameSystemFiles.prototype.unloadAll;

/** In-flight loadAll per system. A WeakMap rather than a field: this class is grafted onto
 *  GameSystemFiles.prototype, and only prototype members come along. */
const loadAllInFlight = new WeakMap<GameSystemFiles, Promise<void>>();

/** The editor half of GameSystemFiles: loading every catalogue is only ever an editor thing. */
class GameSystemFilesEditor extends GameSystemFiles {
  /**
   * Drops the editor's derived state along with the loaded catalogues.
   *
   * The reference index and each catalogue's diagnostics outlive an unload otherwise: nodes
   * are the same objects across a reload, so the stale entries happen to be re-recorded rather
   * than duplicated, but a catalogue deleted from the system keeps its edges and its errors
   * forever.
   */
  unloadAll() {
    for (const catalogue of Object.values(this.loadedCatalogues)) catalogue.resetEditorState();
    this.references?.clear();
    baseUnloadAll.call(this);
  }

  /**
   * Joins an already-running pass rather than starting a second one.
   *
   * `allLoaded` is only set at the end, so opening another catalogue while this is running used
   * to start a whole second walk of the same system: twice the work, and two `current` counters
   * writing to one progress bar, which is what made it jump backwards. The first caller's
   * progress callback keeps driving the display for everyone.
   */
  async loadAll(progress_cb?: (current: number, max: number, msg?: string) => void | Promise<void>) {
    const inflight = loadAllInFlight.get(this);
    if (inflight) return inflight;
    const run = this.loadAllOnce(progress_cb);
    loadAllInFlight.set(this, run);
    try {
      return await run;
    } finally {
      loadAllInFlight.delete(this);
    }
  }

  private async loadAllOnce(progress_cb?: (current: number, max: number, msg?: string) => void | Promise<void>) {
    const max = Object.values(this.catalogueFiles).length + 1;
    let current = 0;
    if (!this.allLoaded) {
      console.log("Loading all catalogues in", this.gameSystem?.gameSystem?.name);
    }
    if (this.gameSystem) {
      progress_cb && (await progress_cb(current, max, `Loading ${this.gameSystem.gameSystem.name}`));
      const loadedSys = await this.loadCatalogue({ targetId: this.gameSystem.gameSystem.id });

      loadedSys.processForEditor();
      current++;

      for (const catalogue of Object.values(this.catalogueFiles)) {
        progress_cb && (await progress_cb(current, max, `Loading ${catalogue.catalogue.name}`));
        const loaded = await this.loadCatalogue({ targetId: catalogue.catalogue.id });
        loaded.processForEditor();
        current++;
        progress_cb && (await progress_cb(current, max, `Loading ${catalogue.catalogue.name}`));
      }
    }
    this.allLoaded = true;
  }
}

/** Copies a class's own prototype members onto another prototype, accessors included. */
function graft(target: object, source: { prototype: object }): void {
  const { constructor: _skip, ...members } = Object.getOwnPropertyDescriptors(source.prototype);
  Object.defineProperties(target, members);
}

graft(Catalogue.prototype, CatalogueEditor);
graft(GameSystemFiles.prototype, GameSystemFilesEditor);

/**
 * The editor half of addToIndex; the shared half only records the node under its id.
 *
 * Assigned rather than written in the class above because shared declares it as an optional
 * property -- that is what lets `this.onIndexed?.(cur)` type-check over there without the
 * editor in scope -- and a class method cannot override a property declaration.
 */
Catalogue.prototype.onIndexed = function (this: Catalogue, cur: EditorBase, previous?: EditorBase) {
  // Records the collision; the duplicate-id message itself is a rule in bs_diagnostics.
  this.claimId(cur, previous);
  this.reindexReferences(cur);
  if (this.manager?.settings?.globalDuplicateIdError && this.manager.index) {
    this.manager.index[cur.id] = cur;
  }
  // Anything that was pointing at this id and could not resolve it is exactly what the
  // reference index lists for that id -- there is no separate waiting-list to keep.
  for (const referrer of [...this.references.referrers(cur.id, "link")]) {
    if (referrer.isLink()) referrer.catalogue?.updateLink(referrer as Link & EditorBase);
  }
  for (const referrer of [...this.references.referrers(cur.id, "other")]) {
    referrer.catalogue?.refreshErrors(referrer);
  }
};

/**
 * `refs` and `other_refs` are computed from the reference index rather than stored.
 *
 * They used to be arrays on each node, appended and spliced from fourteen places; anything
 * that forgot a remove left them quietly wrong. As accessors there is nothing to keep in
 * step and nothing to assign to -- `node.refs = []` is now a TypeError rather than a subtle
 * bug, and neither key reaches the saved file because they are not own properties.
 *
 * Defined here rather than in shared because the wiki path in nuxt-nr keeps its own plain
 * `refs` array on the same key; over there this accessor must not exist.
 */

/**
 * Referrers that actually resolved to this node.
 *
 * The index is keyed by id because indexing must not resolve anything, but ids are unique
 * per catalogue at best -- shared entries get copied between catalogues keeping their id.
 * Handing back the id's referrers unfiltered made every copy claim all of them: the unused
 * copy looked used, and deleting it stripped `target` off links pointing at another copy.
 *
 * A link that resolved elsewhere is not ours. One that resolved nowhere is nobody's, and is
 * left in so a dangling link still shows up against the id it names. Unambiguous ids, which
 * is nearly all of them, take the scan and return the shared array without allocating.
 */
function resolvedReferrers(node: EditorBase, all: EditorBase[]): EditorBase[] {
  const self = $toRaw(node);
  // Written as a loop rather than `all.some(...)` so the common case -- every referrer resolved
  // here, which is nearly every id -- allocates no closure. This runs on every refs read.
  for (let i = 0; i < all.length; i++) {
    const target = (all[i] as Partial<Link>).target;
    if (target !== undefined && $toRaw(target) !== self) {
      return all.filter((o) => {
        const t = (o as Partial<Link>).target;
        return t === undefined || $toRaw(t) === self;
      });
    }
  }
  return all;
}

Object.defineProperty(Base.prototype, "refs", {
  get(this: EditorBase) {
    void revision.value;
    const all = this.catalogue?.references.referrers(this.id, "link");
    return all?.length ? resolvedReferrers(this, all) : (all ?? []);
  },
  configurable: true,
});
Object.defineProperty(Base.prototype, "errors", {
  get(this: EditorBase) {
    void revision.value;
    return this.catalogue?.diagnostics.for(this) ?? [];
  },
  configurable: true,
});
Object.defineProperty(Base.prototype, "other_refs", {
  get(this: EditorBase) {
    void revision.value;
    return this.catalogue?.references.referrers(this.id, "other") ?? [];
  },
  configurable: true,
});

/**
 * A Catalogue answers for itself: catalogueLinks point at it by targetId, which is how
 * reload() finds the catalogues that import this one.
 */
Object.defineProperty(Catalogue.prototype, "refs", {
  get(this: Catalogue) {
    void revision.value;
    return this.references.referrers(this.id, "link");
  },
  configurable: true,
});

/**
 * What the grafts above added, for the type system.
 *
 * Repeats the signatures, but the repetition is checked: CatalogueEditor extends Catalogue,
 * so a declaration here that disagrees with the implementation above is a compile error
 * rather than something that shows up at runtime.
 */
/**
 * What the editor adds to every node, for the type system.
 *
 * These used to be declared on Base in assets/shared. Nothing in shared reads them -- checked
 * one by one -- so all that did was put editor concepts in the roster app's copy of the type.
 * They are installed at runtime from this file: `parentKey` by the onSetPrototype hook above,
 * `editorTypeName`/`other_refs`/`errors` by the accessors below, and the display flags by the
 * store and the tree.
 *
 * Declared on Base rather than only on EditorBase because every node in the editor genuinely
 * has them, and requiring `as EditorBase` for values that already are one was what pushed those
 * casts into ~50 call sites.
 */
declare module "~/assets/shared/battlescribe/bs_main" {
  interface Base {
    /** Which array this node was found in -- always one of the keys entries.ts defines. */
    parentKey: string & keyof typeof entries;
    readonly editorTypeName: string & keyof typeof types;
    /**
     * Declared here, and required, which is the point: shared leaves these off entirely, so
     * there is no optional declaration to merge against. Every node in the editor really does
     * have all three -- refs and other_refs from accessors over the reference index, errors
     * from the catalogue's diagnostic store -- so an editor Base has the same shape as an
     * EditorBase and the two are mutually assignable.
     */
    readonly refs: EditorBase[];
    readonly other_refs: EditorBase[];
    readonly errors: IErrorMessage[];
    showInEditor?: boolean;
    showChildsInEditor?: boolean;
    highlightInEditor?: boolean;
    highlight?: boolean;
  }
}

declare module "~/assets/shared/battlescribe/bs_main_catalogue" {
  interface Catalogue {
    readonly idClaims: Record<string, EditorBase[]>;
    revalidationSuspended?: number;
    readonly diagnostics: DiagnosticStore<EditorBase>;
    readonly errors: IErrorMessage[];
    readonly references: ReferenceIndex<EditorBase>;
    /**
     * Present so a Catalogue satisfies EditorBase -- it is one at runtime, and saying so
     * here is what lets a catalogue be passed to anything that takes a node. Safe now that
     * Base declares refs optional: WikiBase narrows the same name to its own array without
     * colliding.
     */
    readonly refs: EditorBase[];
    readonly other_refs: EditorBase[];
    errorCount(severity?: IErrorMessage["severity"]): number;
    reindexReferences(node: EditorBase): void;
    unindexReferences(node: EditorBase): void;
    removeFromIndex(cur: EditorBase): void;
    processForEditor(): void;
    reload(manager?: BSCatalogueManager): Promise<unknown>;
    addError(obj: EditorBase, newError: IErrorMessage & { id: string }): void;
    removeError(obj: EditorBase, id: string): void;
    removeErrors(obj: EditorBase): void;
    diagnosticContext(): DiagnosticContext;
    revalidate(cur: EditorBase): void;
    withoutRevalidation<T>(fn: () => T): T;
    idCollisions(cur: EditorBase): EditorBase[];
    claimId(cur: EditorBase, previous?: EditorBase): void;
    releaseId(cur: EditorBase): void;
    refreshErrors(cur: EditorBase, _deleted?: boolean): void;
    updateLink(link: Link & EditorBase): boolean;
    revalidateConstraintSiblings(constraint: Constraint & EditorBase): void;
    updateRefsForCondition(condition: EditorBase): void;
    updateCondition(condition: EditorBase, _previousField?: string): void;
    unlinkLink(link: Link & EditorBase): void;
    resetEditorState(): void;
  }
}

declare module "~/assets/shared/battlescribe/local_game_system" {
  interface GameSystemFiles {
    loadAll(progress_cb?: (current: number, max: number, msg?: string) => void | Promise<void>): Promise<void>;
    /** The system-wide reverse reference index; see Catalogue.references. */
    references?: ReferenceIndex<EditorBase>;
    /** The system-wide link cycle index; see cycleIndexFor. */
    cycles?: CycleIndex<EditorBase>;
    cyclesDirty?: boolean;
    /**
     * Depth counter for withoutRevalidation. Held here rather than per catalogue because
     * indexing a node notifies referrers in other catalogues.
     */
    revalidationSuspended?: number;
  }
}

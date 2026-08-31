/**
 * Decides whether a field edit continues the previous one or starts a new undo entry.
 *
 * Split out and kept free of imports so it can be exercised on its own -- a mistake here
 * corrupts the undo stack, which loses work. See field_edit_stack_check.ts.
 */

export interface FieldEditMark {
  node: unknown;
  key: string;
  /** performance.now() of the most recent edit in this burst. */
  at: number;
  /** Value from before the burst started; what a single undo must restore. */
  from: unknown;
  /** Undo position the burst's entry sits at, to notice undo/redo moving underneath it. */
  stackPos: number;
}

export interface FieldEditRequest {
  node: unknown;
  key: string;
  now: number;
  stackPos: number;
  /** `type` of the entry currently on top of the undo stack, if any. */
  topType?: string;
  coalesceMs: number;
}

/** Undo entries created by set_field are tagged with this, so nothing else gets merged into. */
export function fieldEditType(key: string): string {
  return `field:${key}`;
}

/**
 * Continues a burst only while every one of these holds: same node, same key, the stack
 * hasn't moved (no undo/redo/other action in between), the top entry is still this field's,
 * and the user hasn't paused. Otherwise the edit deserves its own step.
 */
export function continuesFieldEdit(last: FieldEditMark | null, req: FieldEditRequest): boolean {
  if (!last) return false;
  if (last.node !== req.node) return false;
  if (last.key !== req.key) return false;
  if (last.stackPos !== req.stackPos) return false;
  if (req.topType !== fieldEditType(req.key)) return false;
  return req.now - last.at < req.coalesceMs;
}

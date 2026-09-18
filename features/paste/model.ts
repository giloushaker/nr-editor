/**
 * Reading a block of text copied from a book into stat lines of a known profile type.
 *
 * The reader is pure: text and the profile types in, rows out. It never touches the catalogue;
 * the page that owns it decides what to create. Tests in ./tests feed it real copies.
 */
import type { SetupProfileType } from "../setup/model";

export type { SetupProfileType };

/** One cell that did not read cleanly. The value is kept as written; the reason is for the author. */
export interface PasteFlag {
  columnId: string;
  reason: "missing" | "format" | "guessed";
}
export interface PastedRow {
  name: string;
  /** Column id -> value, after glyph fixes. Missing cells are absent. */
  values: Record<string, string>;
  flags: PasteFlag[];
  /** A line under the previous row: a firing mode, a blade and a shaft. */
  sub: boolean;
}
export interface PasteSuccess {
  ok: true;
  typeId: string;
  /** How the text was laid out: one row per line, one column after another (screen OCR), or a name then its text. */
  layout: "rows" | "columns" | "blocks";
  rows: PastedRow[];
  /** Lines the reader could not place anywhere. */
  unread: string[];
  /** 0..1, how much of the table fit the type's formats. */
  confidence: number;
}
export interface PasteFailure {
  ok: false;
  /** What was tried and why it did not fit, one line each. */
  reasons: string[];
  /** What the author can do about it. */
  hints: string[];
}
export type PasteResult = PasteSuccess | PasteFailure;

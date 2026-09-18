/**
 * Templates: the recurring sentences of an army book ("One Legionnaire may replace his boltgun
 * with one of the following:") as a pattern of literal words and typed slots. The reader turns a
 * line from the book into a template with its slots filled; what a template writes into the file
 * comes later (bs_write.ts) and is not part of this model.
 */

import type { Recipe } from "./recipe";

/** What a slot accepts. `x` is any known name: a model, an item or an option. */
export type SlotType = "count" | "n" | "nth" | "model" | "item" | "option" | "x" | "scope";

/** One argument of a template: what the wording's {slot} of that name holds. */
export interface TemplateArg {
  name: string;
  type: SlotType;
  /** Used when the wording did not give one: "$n2 ?? 1" without the ??. */
  default?: string;
  doc?: string;
}

export interface Template {
  id: string;
  /** The arguments, declared. The wording's {slots} must be these; rows read them as $name. */
  args?: TemplateArg[];
  /** How it reads back on a card, "replace {item} with one of". */
  name: string;
  /**
   * One or more ways the book says it. Written as plain text with `{slot}` holes: `{model}`,
   * `{item}`, `{count}`, `{n}`, `{nth}`, `{scope}`, `{x}`. A second slot of the same type takes a
   * digit: `{n2}`. Glue words are dropped when read, so "with one of the following" need not be spelled.
   */
  patterns: string[];
  /** Which slots must be filled for a match to count as complete. Default: every slot in the pattern. */
  required?: string[];
  /** Where it can be put. Default: anywhere. */
  appliesTo?: Array<"unit" | "model" | "option" | "group" | "choice" | "force" | "category" | "any">;
  /** Which writer makes it real: a built-in id. A custom template reuses a built-in's writer with its own phrasing. */
  writes?: string;
  /** Saved on this game system rather than built in. */
  custom?: boolean;
  /** What it writes, as rows (recipe.ts). A custom template without one falls back to the recipe of `writes`. */
  recipe?: Recipe;
}

/** Names the reader may fill slots from: what the unit already has and what is shared. */
export interface Known {
  models: string[];
  items: string[];
  options?: string[];
}

export interface Match {
  templateId: string;
  /** The writer to use: the template's `writes`, else its id. */
  writes?: string;
  /** Slot name -> value as written in the book (a name keeps its case, a count is digits). */
  slots: Record<string, string>;
  /** Points read off the line, "- 35 pts", when it carries one. */
  cost?: number;
  /** 0..1. Full literal coverage with every required slot filled is 1. */
  score: number;
  /** Words of the line the template did not account for, in order. */
  leftover: string[];
}

/** One word of a normalised line, typed when it is a number, an ordinal, a scope or a known name. */
export interface Token {
  text: string;
  type?: SlotType;
  value?: string;
}

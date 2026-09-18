/**
 * Text copied from a PDF comes with the page's line breaks in it. `unwrap` takes them out and
 * puts one back at the end of every sentence, which reads well in a rule box and diffs well.
 */
import type { Directive } from "vue";

/** Words a period does not end a sentence after. */
const ABBREVIATIONS = new Set(["e.g", "i.e", "etc", "vs", "no", "pg", "pp", "fig", "mr", "mrs", "dr", "st", "inc", "approx"]);

export function unwrap(text: string): string {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.map(unwrapParagraph).join("\n\n");
}

function unwrapParagraph(p: string): string {
  const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
  let out = "";
  for (const line of lines) {
    if (!out) out = line;
    // A bullet starts its own line. A word cut with a hyphen ("elec-" / "tronically") is joined back.
    else if (/^[-–•*]\s/.test(line)) out += "\n" + line;
    else if (/[a-z]-$/.test(out) && /^[a-z]/.test(line)) out = out.slice(0, -1) + line;
    else out += " " + line;
  }
  return out
    .split("\n")
    .map(sentencesOnLines)
    .join("\n");
}

/** A line break after each sentence: ". ", "! ", "? ", also after a closing bracket or quote, when a capital, digit or bracket follows. */
function sentencesOnLines(s: string): string {
  return s.replace(/([.!?])(["”')\]]?)\s+(?=["“(\[]?[A-Z0-9])/g, (m, end, close, offset: number) => {
    const before = s.slice(0, offset + 1);
    const word = (before.match(/(\S+)$/)?.[1] ?? "").toLowerCase().replace(/[.]+$/, "");
    if (end === "." && (ABBREVIATIONS.has(word) || /^[a-z]$/.test(word))) return m;
    return end + close + "\n";
  });
}

/** v-unwrap-paste on a textarea: what is pasted in goes through unwrap first. */
export const vUnwrapPaste: Directive<HTMLTextAreaElement> = {
  mounted(el) {
    el.addEventListener("paste", (e) => {
      const pasted = e.clipboardData?.getData("text") ?? "";
      if (!/\n/.test(pasted.trim())) return;
      e.preventDefault();
      el.setRangeText(unwrap(pasted), el.selectionStart, el.selectionEnd, "end");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  },
};

/**
 * A plain list of things: a leading count, then the name. "1 Power Fist", "2x Bolt pistol".
 * One per line, or several on a line split by ";" or "," -- a wargear line reads
 * "1 Chainsword; 1 Heavy Bolt Pistol". The preview shows the split before anything is made.
 */
export interface PastedLine {
  name: string;
  count?: number;
}
export function readLines(text: string): PastedLine[] {
  return text
    .split(/\r?\n|[;,]/)
    .map((l) => l.trim().replace(/^[-•*]\s*/, "").replace(/\.$/, ""))
    .filter(Boolean)
    .map((l) => {
      const m = /^(\d+)\s*[x×]?\s+(.+)$/i.exec(l);
      return m ? { name: m[2].trim(), count: Number(m[1]) } : { name: l };
    });
}

import { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { bookNames } from "./profile_import";
import {
  BSIEntryLink,
  BSIInfoLink,
  BSIRule,
  BSISelectionEntry,
  BSISelectionEntryGroup,
} from "~/assets/shared/battlescribe/bs_types";
import { generateBattlescribeId } from "~/assets/shared/battlescribe/bs_helpers";

interface T9ARule {
  title: string;
  def: string;
}

export interface RulesBook {
  name: "Rules";
  version: number;
  nrversion: number;
  permission: number;
  playable: 0;
  id: number;
  rules: Record<string, T9ARule>;
}

function removeNuxtLinks(html: string): string {
  return html.replace(/<nuxt-link\b[^>]*>(.*?)<\/nuxt-link>/gs, "$1");
}

export default class RulesImporter {
  book: RulesBook;
  catalogues: Catalogue[];
  constructor(catalogues: Catalogue[], book: RulesBook) {
    this.book = book;
    this.catalogues = catalogues;
  }

  private async importRule(catalogues: Catalogue[], id: string, t9rule: T9ARule) {
    const split = id.split("-");
    const book = split[0];
    const ruleid = split[1];

    let catalogue: Catalogue | null = null;

    if (book === "rulebook" || book == "special") {
      catalogue = catalogues[0];
    } else {
      const bookName = bookNames[book];
      catalogue = catalogues.find((elt) => elt.name === bookName) || null;
    }

    if (catalogue) {
      if (t9rule.def?.length && t9rule?.title) {
        const rule: BSIRule = {
          description: removeNuxtLinks(t9rule.def),
          name: t9rule.title,
          id: generateBattlescribeId(),
          hidden: false,
        };

        const entry: BSISelectionEntry = {
          id: generateBattlescribeId(),
          name: t9rule.title,
          hidden: false,
          type: "upgrade",
          infoLinks: [
            {
              id: generateBattlescribeId(),
              targetId: rule.id,
              name: rule.name,
              hidden: false,
              type: "rule",
            },
          ],
        };

        $store.add(entry, "sharedSelectionEntries", catalogue as any);
        $store.add(rule, "sharedRules", catalogue as any);
      }
    }
  }

  public async import() {
    for (let rule in this.book.rules) {
      await this.importRule(this.catalogues, rule, this.book.rules[rule]);
    }
  }
}

export function findRule(catalogues: Catalogue[], bookName: string, rulename: string) {
  const cat = catalogues.find((elt) => elt.name === bookName);
  const cats: Catalogue[] = [];
  if (cat) {
    cats.push(cat);
  }
  cats.push(catalogues[0]);

  for (let cat of cats) {
    for (let rule of cat?.sharedSelectionEntries || []) {
      if (rule.name === rulename) {
        const res: BSIEntryLink = {
          type: "selectionEntry",
          targetId: rule.id,
          name: rule.name,
          hidden: false,
          id: generateBattlescribeId(),
          costs: [],
        };
        return res;
      }
    }
  }
}

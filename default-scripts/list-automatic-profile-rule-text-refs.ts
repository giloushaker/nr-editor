import { clone, sortByDescendingInplace } from "~/assets/shared/battlescribe/bs_helpers";
import type { InfoIndex } from "~/assets/shared/battlescribe/bs_info_index";
import type { Base, Characteristic, Profile, Rule } from "~/assets/shared/battlescribe/bs_main";
import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";

export default {
  name: "List all automatic rule/profile text refs",
  arguments: [
    {
      name: "catalogues",
      type: "catalogue[]"
    },
    {
      name: "filter",
      type: "string",
      optional: true,
      description: "preview refs to (exact match)"
    },
  ],
  run(catalogues: Catalogue[], filter?: string) {
    const result = []
    const sys = catalogues[0].getSystem()
    const index = new (Object.getPrototypeOf(sys.infoIndex).constructor as typeof InfoIndex)()
    for (const catalogue of catalogues) {
      catalogue.forEachObjectWhitelist(obj => {
        if (!obj.isLink() && (obj.isProfile() || obj.isRule())) {
          if (!filter || obj.getName() === filter) {
            index.add(obj.getName(), obj)
          }

          if (obj.alias) {
            for (const alias of obj.alias) {
              const copy = clone(obj)
              copy.name = alias;
              if (!filter || alias === filter) {
                index.add(alias, copy)
              }
            }
          }
        }
      })
    }
    const results = {} as Record<string, number>;
    const map = {} as Record<string, Array<EditorBase>>
    const references = [] as EditorBase[]
    for (const catalogue of catalogues) {
      catalogue.forEachObjectWhitelist((obj) => {
        if (!obj.isLink()) {
          let added = false;
          if (obj.isProfile()) {
            (obj as Profile).characteristics?.forEach(o => {
              index.match(o.$text).forEach(m => {
                if (m.match?.length && m.match[0].getName() !== obj.getName()) {
                  results[m.match[0].getName()] = (results[m.match[0].getName()] || 0) + 1
                  map[m.match[0].getName()] = m.match
                  if (filter && !added) references.push(o)
                }
              })
            })
          } else if (obj.isRule()) {
            index.match((obj as Rule).description).forEach(m => {
              if (m.match?.length && m.match[0].getName() !== obj.getName()) {
                results[m.match[0].getName()] = (results[m.match[0].getName()] || 0) + 1
                map[m.match[0].getName()] = m.match
                if (filter && !added) references.push(obj)
              }
            })
          }
        }
      })
    }
    const sorted = sortByDescendingInplace(Object.entries(results), o => o[1])
    const result_referenced = [] as [EditorBase, string][]
    result.push(result_referenced)
    function refcount(obj: EditorBase) {
      return (obj.refs?.length || 0) + (obj.other_refs?.length || 0)
    }
    for (const [text, amount] of sorted) {
      for (const obj of map[text])
        result_referenced.push([obj, `${amount} text refs, ${refcount(obj)} actual refs`])
    }


    if (references.length) {
      result.push(`<div class="bold">References:</div>`)
      for (const ref of references) {
        result.push([ref])
        const text = (ref as Base as Characteristic).$text ?? (ref as Base as Rule).description ?? ""
        const match = index.match(text).map(o => o.match ? `<b>${o.text}</b>` : o.text).join("")
        result.push(`<div class="gray" style="padding-left: 18px; white-space: pre-wrap;">${match}</div>`)
      }
    }

    return result;
  }
}
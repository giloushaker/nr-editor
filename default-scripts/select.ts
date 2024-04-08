import type { Catalogue, EditorBase } from "~/assets/shared/battlescribe/bs_main_catalogue";


function getParents<T>(node: { parent?: T }): NonNullable<T>[] {
  const result = [] as NonNullable<T>[]
  let cur = node as typeof node;
  while (cur.parent) {
    result.push(cur.parent)
    cur = cur.parent as any as typeof node;
  }
  return result
}
function getParentsAndSelf<T>(node: { parent?: T }): NonNullable<T>[] {
  const result = [node as T] as NonNullable<T>[]
  let cur = node as typeof node;
  while (cur.parent) {
    result.push(cur.parent)
    cur = cur.parent as any as typeof node;
  }
  return result
}
class NodeView {
  iter: Iterable<EditorBase>
  followTargets = false
  constructor(iter: Iterable<EditorBase>) {
    this.iter = iter
  }
  self(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      if (cb(val)) result.push(val)
    }
    return this.return(result);
  }
  map(cb: (node: EditorBase) => any) {
    const result = []
    for (const val of this.iter) {
      result.push(cb(val))
    }
    return result
  }
  descendant(cb: (node: EditorBase) => any): NodeView {
    const result = [] as EditorBase[]
    for (const val of this.iter) {
      val.forEachObjectWhitelist((node: EditorBase) => {
        const res = cb(node)
        if (res) result.push(node)
        return res
      })
    }
    return this.return(result);
  }
  child(cb: (node: EditorBase) => any): NodeView {
    const result = [] as EditorBase[]
    for (const val of this.iter) {
      val.forEachObjectWhitelist((node: EditorBase) => {
        const res = cb(node)
        if (res) result.push(node)
        return res
      }, undefined, 2)
    }
    return this.return(result);
  }
  parent(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      if (val.parent && cb(val.parent)) result.push(val.parent)
    }
    return this.return(result);
  }
  ancestor(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      for (const parent of getParents(val)) {
        const res = cb(parent)
        if (res) {
          result.push(res)
          break;
        }
        if (res === false) {
          break;
        }
      }
    }
    return this.return(result);
  }
  has_descendant(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      //@ts-ignore
      if (val.find_recursive(cb, this.followTargets)) result.push(val)
    }
    return this.return(result);
  }
  has_descendant_or_self(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      if (cb(val)) result.push(val)
      //@ts-ignore
      else if (val.find_recursive(cb, this.followTargets)) result.push(val)
    }
    return this.return(result);
  }
  has_child(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      //@ts-ignore
      if (val.find(cb, this.followTargets)) result.push(val)
    }
    return this.return(result);
  }
  has_child_or_self(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      if (cb(val)) result.push(val)
      //@ts-ignore
      else if (val.find(cb, this.followTargets)) result.push(val)
    }
    return this.return(result);
  }
  has_parent(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      if (val.parent && cb(val.parent)) result.push(val)
    }
    return this.return(result);
  }
  has_parent_or_self(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      if (cb(val)) result.push(val)
      else if (val.parent && cb(val.parent)) result.push(val)
    }
    return this.return(result);
  }
  has_ancestor(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      for (const parent of getParents(val)) {
        if (cb(parent)) {
          result.push(val)
          break
        }
      }
    }
    return this.return(result);
  }
  has_ancestor_or_self(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      for (const parent of getParentsAndSelf(val)) {
        if (cb(parent)) {
          result.push(val)
          break
        }
      }
    }
    return this.return(result);
  }
  hasnot_descendant(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      //@ts-ignore
      if (!val.find_recursive(cb, this.followTargets)) result.push(val)
    }
    return this.return(result);
  }
  hasnot_descendant_or_self(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      //@ts-ignore
      if (!cb(val) && !val.find_recursive(cb, this.followTargets)) result.push(val)
    }
    return this.return(result);
  }
  hasnot_child(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      //@ts-ignore
      if (!val.find(cb, this.followTargets)) result.push(val)
    }
    return this.return(result);
  }
  hasnot_child_or_self(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      //@ts-ignore
      if (!cb(val) && !val.find(cb, this.followTargets)) result.push(val)
    }
    return this.return(result);
  }
  hasnot_parent(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      if (!val.parent || !cb(val.parent)) result.push(val)
    }
    return this.return(result);
  }
  hasnot_parent_or_self(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      if (!cb(val) && !(val.parent && cb(val.parent))) result.push(val)
    }
    return this.return(result);
  }
  hasnot_ancestor(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      for (const parent of getParents(val)) {
        if (cb(parent)) {
          break
        }
      }
      result.push(val)
    }
    return this.return(result);
  }
  hasnot_ancestor_or_self(cb: (node: EditorBase) => any): NodeView {
    const result = []
    for (const val of this.iter) {
      for (const parent of getParentsAndSelf(val)) {
        if (cb(parent)) {
          break
        }
      }
      result.push(val)
    }
    return this.return(result);
  }
  return(val: Iterable<EditorBase>) {
    const result = new NodeView(val)
    result.followTargets = this.followTargets
    return result;
  }
}
class SelectParser {
  index = 0;
  tokens: string[] = []
  strings: string[] = []
  regexes: string[] = []
  constructor(query: string) {
    const no_regex = query.replace(/\/((?:\\.|[^//\\])*)\/[a-zA-Z]*/g, (str, groups) => {
      this.regexes.push(groups)
      return `/${this.regexes.length}`
    })
    const no_strings = no_regex.replace(/"((?:\\.|[^"\\])*)"/g, (str, groups) => {
      this.strings.push(groups)
      return `$${this.strings.length}`
    })
    this.tokens = no_strings.trim().match(/(\w+|\$[0-9]+|\s|\W|)/g)?.filter(o => o.trim()) ?? []
  }
  getString(token: string): string {
    return token.startsWith('$') ? this.strings[parseInt(token.slice(1)) - 1]! : token
  }
  peekToken(n = 1) {
    return this.tokens[this.index + n]
  }
  assertToken(n = 1, is: string) {
    if (this.tokens[this.index + n] !== is) {
      throw Error(`SyntaxError: expected token ${this.index + n} to be ${is}`)
    }
  }
  nextToken(n = 1) {
    this.index += n;
    if (this.index >= this.tokens.length) { throw new Error('Invalid input') }
    return this.tokens[this.index]
  }
  nextRange(n = 1) {
    this.assertToken(n, '(')
    let count = 1;
    for (let i = this.index + n; i < this.tokens.length; i++) {
      if (this.tokens[i] === '(') count++;
      if (this.tokens[i] === ')') count--;
      if (count = 0) return i
    }
    throw Error(`SyntaxError: unmatched ( at ${this.index + n})`)
  }
  parse(forEach: (cb: (node: EditorBase) => unknown) => void) {
    const result = [] as EditorBase[]
    for (this.index; this.index < this.tokens.length; this.index++) {
      const token = this.tokens[this.index]
      const str = this.getString(token)
      if (this.peekToken(1) === "=") {
        const val = this.getString(this.nextToken(2));
        forEach((node) => {
          switch (str) {
            case "is":
              if (val === "entry" && node.isEntry()) result.push(node)
              if (val === "group" && node.isGroup()) result.push(node)
              if (val === "link" && node.isLink()) result.push(node)
              else if (node.editorTypeName === val) result.push(node)
              break;
            default:
              if ((node as Record<string, any>)[str] === val) result.push(node)
          }
        });
      }
      else if (this.peekToken(1) === "!" && this.peekToken(2) === "=") {
        const val = this.getString(this.nextToken(3));
        forEach((node) => {
          switch (str) {
            case "is":
              if (val === "entry" && !node.isEntry()) result.push(node)
              if (val === "group" && !node.isGroup()) result.push(node)
              if (val === "link" && !node.isLink()) result.push(node)
              else if (node.editorTypeName !== val) result.push(node)
              break;
            default:
              if ((node as Record<string, any>)[str] !== val) result.push(node)

          }
        });
      } else if (this.peekToken(1) === ":") {
        const relationship = this.peekToken(2)
        const begin = this.peekToken(3)
      }
    }
    return result;
  }
}
export default {
  name: "Select nodes",
  arguments: [
    {
      name: "catalogues",
      type: "catalogue[]"
    },
    {
      name: "query (js)",
      type: "string"
    },
  ],
  run(from: Catalogue[], query: string) {
    const all = [] as EditorBase[]
    from.forEach(o => o.forEachObjectWhitelist((node: EditorBase) => all.push(node)));
    (globalThis as any).$view = new NodeView(all)
    const evaled = eval(`$view.${query}`).iter
    const result = Array.isArray(evaled) ? evaled : evaled.iter || evaled;
    $store.set_selections(result);
    return [`Selected ${result.length} nodes: <code>$store.get_selections())</code>`, result]

  }
}





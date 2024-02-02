import { debug } from "console";

function removeSuffix(from: string, suffix: string): string {
    if (from.endsWith(suffix)) {
        return from.substring(0, from.length - suffix.length);
    }
    return from;
}
function removePrefix(from: string, prefix: string): string {
    if (from.startsWith(prefix)) {
        return from.substring(prefix.length);
    }
    return from;
}
function removeUndefineds(object: Object) {
    for (const key in object) {
        if (object[key] === undefined) delete object[key]
    }
    return object;
}
interface ParsedToken {
    "text": string;
    "type": "token" | "text";
}
class Parser {
    source: string;
    text: string;
    parsed = [] as Array<ParsedToken>;
    constructor(text: string) {
        this.text = text;
        this.source = text;
    }
    text_upto_token(tokens: readonly string[]) {
        if (!this.text) return null
        const regex = new RegExp(tokens.join("|"), "i")
        const result = regex.exec(this.text)
        if (!result) return null
        const idx = result.index
        const found = this.text.substring(0, idx).trim()
        const token = result[0]
        this.text = this.text.substring(idx + token.length).trim()
        const cleanedText = this.clean_text(found)
        if (cleanedText) {
            this.parsed.push({ text: cleanedText, type: "text" })
        }
        this.parsed.push({ text: token, type: "token" })
        return token
    }
    next_token<T extends string>(tokens: readonly T[], space = false): T | null {
        if (!this.text) return null
        for (const token of tokens) {
            if (this.text.toLowerCase().startsWith(space ? token + " " : token)) {
                this.parsed.push({ text: token, type: "token" })
                this.text = this.text.substring(token.length).trim()
                return token
            }
        }
        return null
    }
    clean_text(text: string) {
        text = removePrefix(text, "a ")
        text = removePrefix(text, "an ")
        text = removePrefix(text, "the ")
        text = removePrefix(text, "its ")
        // text = removeSuffix(text, ":")
        text = text.replace(/ \(see .*\)/, "")
        return text
    }
    remainder() {
        if (!this.text) return null
        const text = this.clean_text(this.text)
        if (!text) return null;
        this.parsed.push({ text, type: "text" })
        this.text = "";
        return text
    }
}

interface ParsedOptionsLine {
    tokens: ParsedToken[],
    details: string,
    source: string,
}
function parseOptionsLine(line: string): ParsedOptionsLine {
    if (line.includes("unless")) {
        throw "cant parse 'unless' options"
    }
    line = line.replace("may have may have", "may have");
    const [_, text, details] = line.trim().match(/([^.]*)(?:[.]{2,})?([^.]*)?/) as [unknown, string, string];
    if (!text.startsWith('•') && !text.startsWith('-')) {
        console.warn('invalid input', text)
        return { tokens: [], source: text, details: details }
    }
    const actionTokens = ["may be mounted on a:", "may be mounted on", "may take:", "may take", "must take", "must be mounted on", "may have", "must have", "may be upgraded to", "may replace", "may purchase", "may be:", "may be", "may upgrade", "may:"] as const
    const amountTokens = ["one of the following:", "0-2 of the following", "one of the following", "any of the following:", "up to a total of", "up to", "for every two", "for every three", "worth up to", "a single"] as const
    const whatTokens = ["any unit of", "any unit", "any model in the unit", "the entire unit", "one model", "0-1 unit", "on a", "its", "an", "a:", "a", "the", "any"] as const
    const dashTokens = ["be a", "purchase", "be mounted on a", "upgrade one model to", "have", "a", "include one", "upgrade one", "may purchase", "replace", "be", "add", "magic items", "take"] as const
    const begin = ["•", "-"] as const
    const parser = new Parser(text)
    switch (parser.next_token(begin)) {
        case "•":
            {
                const what = parser.next_token(whatTokens, true)
                if (what) {
                    switch (what) {
                        case "a":
                        case "an":
                        case "0-1 unit":
                        case "any unit of":
                        case "the":
                        case "any":
                            switch (parser.text_upto_token(actionTokens)) {
                                case "may be upgraded to":
                                case "may be":
                                case "may take":
                                    parser.remainder()
                                    break;
                                case "may replace":
                                    parser.text_upto_token(["with:", "with"])
                                    parser.remainder()
                                    break;
                                default:
                                    parser.text_upto_token(amountTokens)
                                    parser.remainder()
                                    break;

                            }
                            break;

                    }
                }

                const action = parser.next_token(actionTokens)
                if (action) {
                    switch (action) {
                        case "may replace":
                            parser.text_upto_token(["with:", "with"])
                            parser.remainder()
                            break;
                        case "may have":
                        case "may take":
                        case "may be":
                        case "must take":
                            parser.next_token(amountTokens)
                            parser.remainder()
                            break;
                        case "may be":
                            parser.next_token(actionTokens)
                            parser.remainder()
                            break;
                        case "may be mounted on":
                        case "may be mounted on a:":
                        case "may be upgraded to":
                        case "must be mounted on":
                            parser.remainder()
                            break;
                        case "may purchase":
                            parser.text_upto_token(amountTokens)
                            break;
                        case "may upgrade":
                            parser.text_upto_token(["to an", "to a"])
                            parser.remainder()
                            break;
                    }
                } else {
                    parser.remainder()
                }
            }
            break;
        case "-":
            switch (parser.next_token(dashTokens, true)) {
                case "be a":
                case "be mounted on a":
                case "upgrade one model to":
                case "have":
                case "be":
                case "add":
                default:
                    parser.remainder();
                    break;
                case "take":
                case "purchase":
                case "may purchase":
                case "magic items":
                    parser.text_upto_token(amountTokens)
                    parser.remainder();
                    break;
                case "a":
                    parser.text_upto_token(actionTokens)
                    parser.text_upto_token(amountTokens)
                    parser.remainder()
                    break;
                case "include one":
                    parser.text_upto_token(["for every three", "for every two"])
                    parser.remainder()
                    break;
                case "upgrade one":
                    parser.text_upto_token(["to"])
                    parser.remainder()
                    break;
                case "replace":
                    parser.text_upto_token(["with"])
                    parser.remainder()
                    break;

            }
            break;
    }
    // console.log(parser.parsed)
    return { tokens: parser.parsed, details: details?.trim(), source: parser.source };
}

function processLines(text: string) {
    // Split the text into lines
    const lines = text.split('\n').map(o => o.trim());
    let result = [];
    let previousLine = "";

    lines.forEach(line => {
        // Check if the line starts with " - " or " • "
        if (line.startsWith("-") || line.startsWith("•")) {
            // If there's a previous line, add it to the result
            if (previousLine.trim()) {
                result.push(previousLine);
            }
            previousLine = line;
        } else {
            // Append the current line to the previous line
            previousLine += " " + line;
        }
    });

    // Add the last line if it's not empty
    if (previousLine !== "") {
        result.push(previousLine);
    }

    return result;
}


interface ParsedOption extends ParsedOptionsLine {
    childs: ParsedOptionsLine[];
}
function parseOptions(options: string) {
    const lines = processLines(options).map(o => o.replace(" // ", "....")).filter(o => o && !o.includes('Unless'));
    const parsedLines = lines.map(o => parseOptionsLine(o) as ParsedOption)
    let lastBullet = null as ParsedOption | null;
    const bullets = []
    for (const line of parsedLines) {
        if (line.tokens[0].text === "•") {
            line.childs = []
            lastBullet = line;
            bullets.push(line)
        } else {
            lastBullet!.childs.push(line)
        }
        line.tokens.shift()
    }
    return bullets
}



function toToken(parsedToken: ParsedToken) {
    return parsedToken.type === "text" ? parsedToken.type : parsedToken.text
}

class TokenIterator {
    tokens: ParsedToken[];
    index = 0;
    last: ParsedToken[] = [];
    constructor(tokens: ParsedToken[]) {
        this.tokens = tokens
    }

    hasTokens(tokens: string | Array<string | string[]>) {
        tokens = Array.isArray(tokens) ? tokens : [tokens];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i]
            const parsed = this.tokens[i + this.index]
            if (typeof token === "string") {
                if (toToken(parsed) !== token) return false;
            } else {
                if (!token.includes(toToken(parsed))) return false;
            }
        }
        this.last = this.tokens.slice(this.index, this.index + tokens.length)
        this.index += tokens.length
        return true;
    }
    next() {
        if (this.index >= this.tokens.length) return null;
        const result = this.tokens[this.index]
        this.last = [result]
        this.index += 1
        return result;
    }
    nextAlways() {
        if (this.index >= this.tokens.length) throw Error("nextAlways failed")
        return this.next()!
    }
    maybeNextText() {
        while (this.index < this.tokens.length) {
            const found = this.tokens[this.index]
            this.index += 1;
            if (found.type === "text") {
                this.last = [found]
                return found
            }
        }
        return null

    }
    nextText() {
        while (this.index < this.tokens.length) {
            const found = this.tokens[this.index]
            this.index += 1;
            if (found.type === "text") {
                this.last = [found]
                return found
            }
        }
        throw Error("nextText failed")
    }
    lastText() {
        for (let i = this.last.length - 1; i >= 0; i--) {
            if (this.last[i].type === "text") {
                return this.last[i].text
            }
        }
        return null
    }
    remaining() {
        return (this.tokens.length - this.index)
    }
}
function hashTokens(tokens: ParsedToken[]) {
    const result = tokens.map(o => o.type === "text" ? o.type : o.text).join("&&")
    return result;
}
interface ParsedScope {
    scope: string;
    amount: string;
}
function getScope(it: TokenIterator): ParsedScope {
    if (it.hasTokens(["any model in the unit"])) return { scope: "model", amount: "*" }
    if (it.hasTokens(["the entire unit"])) return { scope: "unit", amount: "*" }
    if (it.hasTokens(["0-1 unit", "in your army"])) return { scope: "unit", amount: "1" }
    if (it.hasTokens(["0-1 unit", "text"])) {
        const amount = it.lastText()!
        return { scope: "unit", amount }
    }
    if (it.hasTokens([["any unit of"], "text"])) return { scope: it.lastText()!, amount: "*" }
    if (it.hasTokens(["any unit"])) return { scope: "unit", amount: "*" }
    if (it.hasTokens([["any"], "text"])) return { scope: it.lastText()!, amount: "*" }
    if (it.hasTokens([["a", "an", "the"], "text"])) return { scope: it.lastText()!, amount: "1" }
    return { scope: "self", amount: "*" }

}
function getGroupAmount(it: TokenIterator) {
    const text = it.nextAlways().text
    switch (text) {
        case "may:":
        case "may take:":
        case "may be":
        case "may be:":
            return "*"
        case "must take":
            const mustTakeWhat = it.nextAlways().text
            if (mustTakeWhat === "one of the following:") return "1";
            if (mustTakeWhat === "one of the following") return "1";
            console.warn(`unparsed group (${text}) amount`, mustTakeWhat)
            return null;
        case "may take":
        case "may have": {
            const mayTakeWhat = it.nextAlways().text
            if (mayTakeWhat === "one of the following:") return "0-1";
            if (mayTakeWhat === "one of the following") return "0-1";
            if (mayTakeWhat === "any of the following:") return "*";
            if (mayTakeWhat === "0-2 of the following") return "0-2";
            console.warn(`unparsed group (${text}) amount`, mayTakeWhat)
            return "*";
        }

        case "may replace":
            return "1"
        case "must be mounted on":
            it.nextAlways()
            return "1"
        case "may be mounted on a:":
        case "may be mounted on":
            return "0-1"
        default:
            console.warn("unparsed group amount", text, it)
            return null
    }
}
export interface OptionsEntry {
    for?: string;
    what?: string;
    token?: string;
    scope: string;
    amount: string;
    details?: string
    to?: string;
    with?: string;
    type?: string;
}
export interface OptionsGroup {
    scope: string;
    amount: string;
    groupAmount: string;
    replace?: string,
    details?: string,
    specification?: string,
    entries: OptionsEntry[]
}
export function optionsToGroups(options: string) {
    const groups = [] as OptionsGroup[]
    const entries = [] as OptionsEntry[]

    let index = 0;
    for (const bulletLine of parseOptions(options)) {
        index += 1;
        const local = []
        const it = new TokenIterator(bulletLine.tokens)
        if (!bulletLine.childs.length && (!bulletLine.source.endsWith(":"))) {
            const { scope, amount } = getScope(it)
            const scopeHash = `${amount}/${scope}`
            const firstToken = toToken(it.nextAlways())
            const obj = { scope, amount, details: bulletLine.details, source: bulletLine.source }
            switch (firstToken) {
                case "text":
                    entries.push({ ...obj, what: it.lastText()!, token: firstToken })
                    break;
                case "may be":
                    entries.push({ ...obj, what: it.maybeNextText()?.text, token: firstToken })
                    break;
                case "may have":
                case "may take":
                case "may be upgraded to":
                case "may be mounted on":
                    entries.push({ ...obj, what: it.nextText().text, token: firstToken })
                    break;
                case "may purchase":
                    entries.push({ ...obj, what: it.nextText().text, token: firstToken })
                    it.nextAlways()
                    break;
                case "may upgrade":
                    entries.push({ ...obj, what: it.nextText().text, to: it.nextText()?.text, type: "upgrade" })
                    break;
                case "may replace":
                    entries.push({ ...obj, what: it.nextText().text, with: it.nextText().text, type: "replace" })
                    break;
                default:
                    console.warn("unhandled token", firstToken)

            }
            if (it.remaining()) {
                console.error(`didnt finish parsing (remaining ${it.remaining()} tokens)`, bulletLine.source)
            }
            continue;
        }
        const { scope, amount } = getScope(it)
        const groupAmount = getGroupAmount(it) || bulletLine.details;
        const groupReplace = it.last[0].text === "may replace"
        let groupReplaceWhat;
        if (groupReplace) {
            groupReplaceWhat = it.nextText()
            it.nextAlways()
        }
        const groupSpecification = it.next()?.text
        const group = {
            scope, amount, groupAmount,
            replace: groupReplaceWhat,
            details: bulletLine.details,
            specification: groupSpecification,
            entries: [] as OptionsEntry[],
            source: bulletLine.source,
        }
        // if groupAmount is a * (meaning any), its entries can be taken out of the group.
        for (const dashLine of bulletLine.childs) {
            const dashIt = new TokenIterator(dashLine.tokens)
            const firstToken = toToken(dashIt.nextAlways())
            const obj = { scope, amount, details: dashLine.details, source: dashLine.source, parentSource: bulletLine.source }
            switch (firstToken) {
                case "text":
                    group.entries.push({
                        ...obj,
                        what: dashIt.lastText()!,
                        details: dashLine.details,
                        token: firstToken
                    })
                    break;
                case "a":
                case "an":
                    const what = dashIt.nextAlways().text;
                    if (groupReplaceWhat) {
                        group.entries.push({
                            ...obj,
                            what: groupReplaceWhat.text,
                            with: what,
                            type: "replace",
                        })
                        break;
                    }
                    group.entries.push({
                        ...obj,
                        what,
                        details: dashLine.details
                    })
                    break;
                case "be a":
                case "be":
                case "add":
                case "be mounted on a":
                case "have":
                case "take":
                    group.entries.push({
                        ...obj,
                        what: dashIt.nextText().text,
                        token: firstToken
                    })
                    break;
                case "may purchase":
                case "purchase":
                    group.entries.push({
                        ...obj,
                        what: dashIt.nextText().text
                    })
                    dashIt.nextAlways()
                    break;
                case "upgrade one":
                    group.entries.push({
                        ...obj,
                        what: dashIt.nextText().text,
                        to: dashIt.nextText().text,
                        type: "upgrade"
                    })
                    break;
                case "upgrade one model to":
                    group.entries.push({
                        ...obj,
                        what: "model",
                        to: dashIt.nextText().text,
                        type: "upgrade"
                    })
                    break;
                case "include one":
                    group.entries.push({
                        ...obj,
                        what: dashIt.nextText().text,
                        for: dashIt.nextText().text,
                        type: "include",
                    })
                    break;
                case "replace":
                    group.entries.push({
                        ...obj,
                        what: dashIt.nextText().text,
                        with: dashIt.nextText().text,
                        type: "replace",
                    })
                    break;
                case "magic items":
                    dashIt.nextAlways()
                    group.entries.push({
                        ...obj,
                        what: "magic items"
                    })
                    break;
                default:
                    console.warn("unhandled token", firstToken)
                    if (dashIt.remaining()) {
                        console.error(`didnt finish parsing (remaining ${dashIt.remaining()} tokens)`, dashLine.source)
                    }
            }
            if (it.remaining()) {
                console.error(`didnt finish parsing (remaining ${it.remaining()} tokens)`, bulletLine.source)
            }
        }
        // if (group.source === "• May be mounted on a:") debugger;
        group.entries = group.entries.map(o => removeUndefineds(o))
        if (group.groupAmount === "*") {
            entries.push(...group.entries)
        } else {
            groups.push(removeUndefineds(group))
        }
    }
    entries.forEach(o => removeUndefineds(o))
    const result = {
        groups: groups,
        entries: entries,
    }
    return result;
}
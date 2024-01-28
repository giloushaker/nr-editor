
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

class Parser {
    text: string;
    parsed = [] as string[];
    parsed_tokens = [] as string[]
    constructor(text: string) {
        this.text = text;
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
            this.parsed.push(cleanedText)
            this.parsed_tokens.push("text")
        }
        this.parsed.push(token)
        this.parsed_tokens.push(token)
        return token
    }
    next_token<T extends string>(tokens: readonly T[], space = false): T | null {
        if (!this.text) return null
        for (const token of tokens) {
            if (this.text.toLowerCase().startsWith(space ? token + " " : token)) {
                this.parsed.push(token)
                this.parsed_tokens.push(token)
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
        text = removeSuffix(text, ":")
        text = text.replace(/ \(see .*\)/, "")
        return text
    }
    remainder() {
        if (!this.text) return null
        const text = this.clean_text(this.text)
        if (!text) return null;
        this.parsed.push(text)
        this.parsed_tokens.push("text")
        this.text = "";
        return text
    }
}

function parseOptionsLine(line: string) {
    if (line.includes("unless")) {
        throw "cant parse 'unless' options"
    }
    const actionTokens = ["may be mounted on", "may take:", "may take", "must take", "must be mounted on", "may have", "must have", "may be upgraded to", "may replace", "may purchase", "may be:", "may be", "may upgrade", "may:"] as const
    const amountTokens = ["one of the following:", "any of the following:", "up to a total of", "up to", "for every two", "for every three", "worth up to"] as const
    const whatTokens = ["any unit of", "any unit", "any model in the unit", "the entire unit", "one model", "0-1 unit", "on a", "its", "an", "a", "the", "any"] as const
    const dashTokens = ["be a", "purchase", "be mounted on a", "upgrade one model to", "have", "a", "include one", "upgrade one", "may purchase", "replace", "be", "add", "magic items", "take"] as const
    const begin = ["•", "-"] as const
    const parser = new Parser(line)

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
                        case "may be upgraded to":
                        case "must be mounted on":
                            parser.remainder()
                            break;
                        case "may purchase":
                            parser.text_upto_token(amountTokens)
                            break;
                        case "may upgrade":
                            parser.text_upto_token(["to a"])
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
    return parser

}
export function stripHtml(originalString: string): string {
    if (originalString == null) {
        return "";
    }

    let res = originalString.replace(/<br ?[/]?>/g, "\n");
    res = res.replace(/(<([^>]+)>)/gi, "");
    res = res.replace(/&bull;/g, "•");
    res = res.replace(/[&][^;]*;/g, "");
    res = res.replace(/\n */g, "\n");
    res = res.replace(/\n\n*/g, "\n");
    res = res.replace(/−/g, "-");
    return res;
}
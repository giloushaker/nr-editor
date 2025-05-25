export function toTitleCaseWords(str: string): string {
  if (str.includes("-")) {
    // kebab-case or similar
    return str
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } else if (str.includes("_")) {
    // snake_case
    return str
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } else {
    // camelCase or PascalCase
    return str.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  }
}

// Examples:
console.log(toTitleCaseWords("camelCaseToWords")); // "Camel Case To Words"
console.log(toTitleCaseWords("kebab-case-to-words")); // "Kebab Case To Words"
console.log(toTitleCaseWords("snake_case_to_words")); // "Snake Case To Words"

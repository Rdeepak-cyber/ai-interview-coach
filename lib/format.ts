export function toTitleCase(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .replace(/\b[a-zA-Z]+/g, (word) => {
      const lower = word.toLowerCase();
      if (lower === "ui" || lower === "ux" || lower === "ai" || lower === "ml" || lower === "qa" || lower === "it") {
        return lower.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}


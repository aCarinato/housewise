// Small string helpers shared by formatting and UI layers.
export function normalizeSpaces(input: string): string {
  if (!input) {
    return "";
  }

  return input.replace(/\s+/g, " ").trim();
}

export function truncateWords(input: string, maxWords: number): string {
  const normalized = normalizeSpaces(input ?? "");
  if (!normalized || maxWords <= 0) {
    return "";
  }

  const words = normalized.split(" ");
  if (words.length <= maxWords) {
    return normalized;
  }

  const snippet = words.slice(0, maxWords).join(" ");
  return `${snippet.replace(/[.,;:]+$/, "")}…`;
}

export function toMoney(n?: number | null): string {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return "—";
  }

  const formatted = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

  return formatted.replace(/\u00A0/g, " ");
}

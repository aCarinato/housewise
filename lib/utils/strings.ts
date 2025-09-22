// Small string helpers shared by formatting and UI layers.
export function truncateWords(input: string, maxWords: number): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed || maxWords <= 0) {
    return "";
  }

  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) {
    return trimmed;
  }

  return `${words.slice(0, maxWords).join(" ")}…`;
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

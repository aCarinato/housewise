import { normalizeSpaces } from "../utils/strings";

const PUNCT_ONLY_REGEX = /^[\p{P}\p{S}]+$/u;

/**
 * Splits a plain text input into cleaned, meaningful lines ready for normalization.
 */
export function parseTextToLines(input: string): string[] {
  if (!input) {
    return [];
  }

  const normalized = input.replace(/\r\n?|\r/g, "\n");
  const rawLines = normalized.split("\n");

  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const cleaned = normalizeSpaces(rawLine);
    if (!cleaned) {
      continue;
    }

    if (PUNCT_ONLY_REGEX.test(cleaned)) {
      continue;
    }

    lines.push(cleaned);
  }

  return lines;
}

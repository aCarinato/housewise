import { normalizeSpaces } from "../utils/strings";

type PdfParseFn = (data: Buffer | Uint8Array) => Promise<{
  text: string;
}>;

let cachedPdfParse: PdfParseFn | null = null;

async function loadPdfParse(): Promise<PdfParseFn> {
  if (!cachedPdfParse) {
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const fn = (mod as unknown as { default?: PdfParseFn }).default ?? (mod as unknown as PdfParseFn);
    if (typeof fn !== "function") {
      throw new Error("Impossibile caricare il modulo pdf-parse");
    }
    cachedPdfParse = fn;
  }
  return cachedPdfParse;
}

/**
 * Extracts textual lines from a PDF buffer using pdf-parse.
 */
export async function parsePdfToLines(fileBuffer: Buffer): Promise<string[]> {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error("File PDF vuoto o non leggibile");
  }

  const pdfParse = await loadPdfParse();
  const result = await pdfParse(fileBuffer);
  const rawText = result.text ?? "";

  if (rawText.trim().length < 30) {
    // TODO: attivare pipeline OCR per PDF scansionati (es. Tesseract) se necessario.
  }

  const normalized = rawText.replace(/\r\n?|\r/g, "\n");
  const rawLines = normalized.split("\n");

  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const cleaned = normalizeSpaces(rawLine);
    if (!cleaned) {
      continue;
    }

    lines.push(cleaned);
  }

  return lines;
}

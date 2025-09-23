import { parsePdfToLines } from "./pdf";
import { parseTextToLines } from "./text";
import { parseXlsxOrCsvToLines } from "./xlsx";
import { getFileExtension, isSupportedExtension, SUPPORTED_FILE_EXTENSIONS } from "../utils/file";
import { normalizeSpaces } from "../utils/strings";

export type SupportedMime =
  | "application/pdf"
  | "text/plain"
  | "text/csv"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const SUPPORTED_EXTENSIONS = SUPPORTED_FILE_EXTENSIONS;

export interface ParsedSource {
  sorgente: string;
  lines: string[];
  meta: { fileName: string; mime?: string; size?: number };
}

const MIME_BY_EXTENSION: Record<string, SupportedMime> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * Collapses extra spaces and removes blank entries from a line array.
 */
function cleanLines(lines: string[]): string[] {
  if (!Array.isArray(lines)) {
    return [];
  }

  const cleaned: string[] = [];
  for (const line of lines) {
    const normalized = normalizeSpaces(line ?? "");
    if (!normalized) {
      continue;
    }

    cleaned.push(normalized);
  }

  return cleaned;
}

function resolveMime(file: File, extension: string): SupportedMime | null {
  const directMime = (file.type || "").toLowerCase() as SupportedMime;
  if (directMime && Object.values(MIME_BY_EXTENSION).includes(directMime)) {
    return directMime;
  }

  if (extension && MIME_BY_EXTENSION[extension]) {
    return MIME_BY_EXTENSION[extension];
  }

  return null;
}

function ensureSupported(extension: string, mime: SupportedMime | null, fileName: string): void {
  if (extension && isSupportedExtension(extension)) {
    return;
  }

  if (mime && Object.values(MIME_BY_EXTENSION).includes(mime)) {
    return;
  }

  throw new Error(`Formato non supportato: ${fileName || mime || extension || "sconosciuto"}`);
}

/**
 * Maps an index to the canonical sorgente labels A/B/C.
 */
export function inferSorgente(index: number): "A" | "B" | "C" {
  if (index === 0) return "A";
  if (index === 1) return "B";
  if (index === 2) return "C";
  throw new Error("Sono supportati al massimo tre preventivi (A, B, C)");
}

/**
 * Parses an uploaded File into normalized textual lines.
 */
export async function parseFileToLines(file: File): Promise<string[]> {
  if (!file) {
    throw new Error("File non fornito");
  }

  const extension = getFileExtension(file.name);
  const mime = resolveMime(file, extension);

  ensureSupported(extension, mime, file.name);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer || buffer.length === 0) {
    throw new Error(`File vuoto: ${file.name || "senza nome"}`);
  }

  let rawLines: string[] = [];

  switch (mime ?? MIME_BY_EXTENSION[extension]) {
    case "application/pdf":
      rawLines = await parsePdfToLines(buffer);
      break;
    case "text/plain":
      rawLines = parseTextToLines(buffer.toString("utf8"));
      break;
    case "text/csv":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      rawLines = parseXlsxOrCsvToLines(buffer, file.name);
      break;
    default:
      // TODO: se abilitato AI-native upload, inviare il PDF direttamente al modulo AI e ricevere le righe.
      throw new Error(`Formato non gestito: ${mime ?? extension}`);
  }

  const lines = cleanLines(rawLines);
  if (lines.length === 0) {
    throw new Error(`File vuoto o non interpretabile: ${file.name || "senza nome"}`);
  }

  return lines;
}

/**
 * Parses either in-memory text or an uploaded file into lines.
 */
export async function parseToLines(input: { file?: File; text?: string }): Promise<string[]> {
  if (input.file) {
    return parseFileToLines(input.file);
  }

  if (input.text) {
    return cleanLines(parseTextToLines(input.text));
  }

  throw new Error("Nessun contenuto da analizzare");
}

/**
 * Parses a batch of files (1-3) and labels them as A/B/C.
 */
export async function parseUploadedFiles(files: File[]): Promise<ParsedSource[]> {
  if (!files || files.length === 0) {
    throw new Error("Carica almeno un preventivo");
  }

  if (files.length > 3) {
    throw new Error("Puoi caricare al massimo tre preventivi");
  }

  const parsed: ParsedSource[] = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const sorgente = inferSorgente(i);

    try {
      const lines = await parseFileToLines(file);
      parsed.push({
        sorgente,
        lines,
        meta: {
          fileName: file.name || `Preventivo ${sorgente}`,
          mime: file.type || undefined,
          size: typeof file.size === "number" ? file.size : undefined,
        },
      });
    } catch (error) {
      const label = file?.name || `file ${i + 1}`;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Errore durante il parsing di ${label}: ${message}`);
    }
  }

  return parsed;
}

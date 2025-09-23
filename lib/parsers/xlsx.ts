import * as XLSX from "xlsx";
import { normalizeSpaces } from "../utils/strings";

/**
 * Extracts textual lines from XLSX/CSV buffers by flattening rows.
 */
export function parseXlsxOrCsvToLines(fileBuffer: Buffer, fileName?: string): string[] {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error(`File ${fileName ?? "XLSX/CSV"} vuoto o non leggibile`);
  }

  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const lines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown as Array<Array<string | number | boolean | null>>;

    for (const row of rows) {
      if (!Array.isArray(row)) {
        continue;
      }

      const cellValues = row
        .map((cell) => {
          if (cell === null || cell === undefined) {
            return "";
          }
          if (typeof cell === "string") {
            return cell;
          }
          if (typeof cell === "number" || typeof cell === "boolean") {
            return String(cell);
          }
          return "";
        })
        .filter((value) => value && value.trim().length > 0);

      if (cellValues.length === 0) {
        continue;
      }

      const joined = cellValues.join(" - ");
      const flattened = joined.split(/\n+/);
      for (const segment of flattened) {
        const cleaned = normalizeSpaces(segment);
        if (!cleaned) {
          continue;
        }

        lines.push(cleaned);
      }
    }
  }

  return lines;
}

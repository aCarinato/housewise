export const SUPPORTED_FILE_EXTENSIONS = [".pdf", ".txt", ".csv", ".xlsx"] as const;

/**
 * Returns the lowercased extension (including dot) from a file name.
 */
export function getFileExtension(name?: string): string {
  if (!name) {
    return "";
  }

  const match = /\.([^.]+)$/.exec(name);
  return match ? `.${match[1].toLowerCase()}` : "";
}

/**
 * Checks whether the provided extension is allowed by the parser.
 */
export function isSupportedExtension(ext: string): boolean {
  if (!ext) {
    return false;
  }

  const normalized = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return SUPPORTED_FILE_EXTENSIONS.includes(normalized as (typeof SUPPORTED_FILE_EXTENSIONS)[number]);
}

/**
 * Produces a human-readable size string from a byte length.
 */
export function bytesToReadable(size?: number): string {
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  const kb = size / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }

  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

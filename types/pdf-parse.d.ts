declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
  }

  type PdfParseFn = (data: Buffer | Uint8Array) => Promise<PdfParseResult>;

  const pdfParse: PdfParseFn;

  export default pdfParse;
}

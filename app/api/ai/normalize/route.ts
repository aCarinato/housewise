// // app/api/ai/normalize/route.ts
// import { promises as fs } from 'node:fs';
// import { tmpdir } from 'node:os';
// import { randomUUID } from 'node:crypto';
// import { join } from 'node:path';
// import { NextRequest, NextResponse } from 'next/server';
// import {
//   GoogleGenerativeAI,
//   type Content,
//   type Part,
// } from '@google/generative-ai';
// import { GoogleAIFileManager } from '@google/generative-ai/files';
// import { parseTextToLines } from '@/lib/parsers/text';
// import { parseXlsxOrCsvToLines } from '@/lib/parsers/xlsx';

// export const runtime = 'nodejs';

// const ALLOWED_EXT = ['.pdf', '.txt', '.csv', '.xlsx'] as const;
// const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

// const CATEGORIES = [
//   'demolizioni_smaltimenti',
//   'impianto_elettrico',
//   'impianto_idrico_sanitario',
//   'impianto_termico_riscaldamento_caldaia',
//   'gas',
//   'pavimenti_rivestimenti_massetti',
//   'bagno_forniture_sanitari_rubinetteria',
//   'cucina_lavori_idrici_elettrici',
//   'porte_interne',
//   'serramenti_infissi',
//   'pittura_cartongesso_controssoffitti',
//   'pratiche_tecniche_permessi_dico',
//   'condizionamento_ventilazione',
//   'impianto_fotovoltaico_pannelli',
//   'batteria_accumulo',
//   'inverter_fotovoltaico',
//   'pratiche_autorizzative_fotovoltaico_gse',
//   'pompe_di_calore',
//   'altri_extra',
//   'unknown',
// ] as const;

// const FLAGS = [
//   'marca_materiale_mancante',
//   'dico_mancante',
//   'smaltimento_non_menzionato',
//   'quantita_non_chiara',
//   'esclusioni_presenti',
//   'garanzia_non_specificata',
//   'pratiche_autorizzative_non_menzionate',
// ] as const;

// type Category = (typeof CATEGORIES)[number];
// type Flag = (typeof FLAGS)[number];

// interface AiNormalizedItem {
//   source_index?: number;
//   page?: number;
//   descrizione_originale?: string;
//   descrizione_normalizzata?: string;
//   categoria?: Category | string; // l'AI potrebbe restituire una non valida → la sanifichiamo
//   importo_euro?: number | string | null;
//   quantita?: number | string | null;
//   unita?: string | null;
//   prezzo_unitario_eur?: number | string | null;
//   flags?: Flag[];
//   confidence_ai?: number;
// }

// interface AiPerSourceSummary {
//   totali_per_categoria?: Record<string, number>;
//   inclusioni_evidenti?: string[];
//   esclusioni_evidenti?: string[];
//   checklist_mancanze?: string[];
//   punti_ambigui?: string[];
//   stima_totale_documento?: number | null;
// }

// interface AiStructuredResponse {
//   source_label?: string;
//   file_name?: string;
//   items: AiNormalizedItem[];
//   per_source_summary: AiPerSourceSummary;
//   notes?: string[];
// }

// /** ───────────────────────────────────────────────────────────────
//  *  RESPONSE SCHEMA (Structured outputs)
//  *  ─────────────────────────────────────────────────────────────── */

// const responseSchema = {
//   type: 'object',
//   properties: {
//     source_label: { type: 'string' },
//     file_name: { type: 'string' },
//     items: {
//       type: 'array',
//       items: {
//         type: 'object',
//         properties: {
//           source_index: { type: 'integer' },
//           page: { type: 'integer' },
//           descrizione_originale: { type: 'string' },
//           descrizione_normalizzata: { type: 'string' },
//           categoria: { type: 'string', enum: Array.from(CATEGORIES) },
//           importo_euro: { type: 'number' }, // niente null nello schema
//           quantita: { type: 'number' },
//           unita: { type: 'string' },
//           prezzo_unitario_eur: { type: 'number' },
//           flags: {
//             type: 'array',
//             items: { type: 'string', enum: Array.from(FLAGS) },
//           },
//           confidence_ai: { type: 'number' },
//         },
//         required: [
//           'descrizione_originale',
//           'descrizione_normalizzata',
//           'categoria',
//           'importo_euro',
//           'flags',
//           'confidence_ai',
//         ],
//       },
//     },
//     per_source_summary: {
//       type: 'object',
//       properties: {
//         // ⬇️ invece di object libero, usiamo un array di coppie
//         totali_per_categoria: {
//           type: 'array',
//           items: {
//             type: 'object',
//             properties: {
//               categoria: { type: 'string', enum: Array.from(CATEGORIES) },
//               totale: { type: 'number' },
//             },
//             required: ['categoria', 'totale'],
//           },
//         },
//         inclusioni_evidenti: { type: 'array', items: { type: 'string' } },
//         esclusioni_evidenti: { type: 'array', items: { type: 'string' } },
//         checklist_mancanze: { type: 'array', items: { type: 'string' } },
//         punti_ambigui: { type: 'array', items: { type: 'string' } },
//         stima_totale_documento: { type: 'number' },
//       },
//       required: ['totali_per_categoria', 'checklist_mancanze'],
//     },
//     notes: { type: 'array', items: { type: 'string' } },
//   },
//   required: ['items', 'per_source_summary'],
// } as const;

// // const responseSchema = {
// //   type: 'object',
// //   properties: {
// //     source_label: { type: 'string' },
// //     file_name: { type: 'string' },
// //     items: {
// //       type: 'array',
// //       items: {
// //         type: 'object',
// //         properties: {
// //           source_index: { type: 'integer' },
// //           page: { type: 'integer' },
// //           descrizione_originale: { type: 'string' },
// //           descrizione_normalizzata: { type: 'string' },
// //           categoria: {
// //             type: 'string',
// //             enum: CATEGORIES as unknown as string[],
// //           },
// //           importo_euro: { type: ['number', 'null'] },
// //           quantita: { type: ['number', 'null'] },
// //           unita: { type: ['string', 'null'] },
// //           prezzo_unitario_eur: { type: ['number', 'null'] },
// //           flags: {
// //             type: 'array',
// //             items: { type: 'string', enum: FLAGS as unknown as string[] },
// //           },
// //           confidence_ai: { type: 'number' },
// //         },
// //         required: [
// //           'descrizione_originale',
// //           'descrizione_normalizzata',
// //           'categoria',
// //           'importo_euro',
// //           'flags',
// //           'confidence_ai',
// //         ],
// //       },
// //     },
// //     per_source_summary: {
// //       type: 'object',
// //       properties: {
// //         totali_per_categoria: {
// //           type: 'object',
// //           additionalProperties: { type: 'number' },
// //         },
// //         inclusioni_evidenti: { type: 'array', items: { type: 'string' } },
// //         esclusioni_evidenti: { type: 'array', items: { type: 'string' } },
// //         checklist_mancanze: { type: 'array', items: { type: 'string' } },
// //         punti_ambigui: { type: 'array', items: { type: 'string' } },
// //         stima_totale_documento: { type: ['number', 'null'] },
// //       },
// //       required: ['totali_per_categoria', 'checklist_mancanze'],
// //     },
// //     notes: { type: 'array', items: { type: 'string' } },
// //   },
// //   required: ['items', 'per_source_summary'],
// // } as const;

// /** ───────────────────────────────────────────────────────────────
//  *  PROMPT
//  *  ─────────────────────────────────────────────────────────────── */
// const SYSTEM = `
// Sei un normalizzatore di voci di preventivi per ristrutturazioni e impianti in Italia.
// NON inventare voci, quantità o prezzi. Se incerto → categoria "unknown".
// Restituisci SOLO JSON conforme allo schema. descrizione_normalizzata ≤ 15 parole.
// Regole flag:
// - "esclusioni_presenti" se la riga contiene "escluso", "non incluso", "a carico del cliente".
// - "marca_materiale_mancante" se trovi "fornitura" ma non "marca"/"modello".
// - Per FV/batteria/inverter/PdC senza pratiche citate → "pratiche_autorizzative_non_menzionate".
// - Se non emergono quantità tipiche (punti luce, kWp, kWh, n./pz/cifre) → "quantita_non_chiara".
// Linee guida categorie:
// - "opere murarie"/"tramezzi"/"muri doccia"/"cassette incasso" NON sono "sanitari": se non c'è categoria dedicata, usare "altri_extra" o "pittura_cartongesso_controssoffitti".
// Regola inclusioni:
// - Inserisci "fornitura inclusa" SOLO se nel testo compaiono termini come "fornitura", "acquisto", "compreso". In assenza, non dare per inclusa la fornitura.
// `.trim();

// const ONTOLOGY = `
// Categorie ammesse:
// ${CATEGORIES.join(', ')}.
// Flags ammessi:
// ${FLAGS.join(', ')}.
// `.trim();

// const INSTRUCTIONS = `
// 1) Estrai tutte le voci rilevanti: descrizione_originale, categoria (una sola), importo_euro (se presente), flags e confidence_ai.
//    Quando disponibili, estrai anche quantita, unita e prezzo_unitario_eur (opzionali).
// 2) Compila per_source_summary:
//    - totali_per_categoria: somma importi per categoria coerente con gli items. Se il documento è "a corpo", imputa il totale a "altri_extra" e scrivilo nelle note.
//    - inclusioni_evidenti / esclusioni_evidenti: inserisci SEMPRE 3–6 bullet totali (se deducibili), es. "smaltimento incluso", "sanitari esclusi".
//    - checklist_mancanze: tempi non indicati, marche non specificate, quantità non chiare, DiCo assenti, ecc.
//    - punti_ambigui: elementi non chiari da chiedere all'impresa.
//    - stima_totale_documento: importo a corpo o somma delle voci (deve essere coerente con la somma degli items che hanno importo).
// 3) Coerenza: i totali per categoria DEVONO corrispondere alla somma degli items nella stessa categoria.
// 4) Non scrivere testo fuori dal JSON. Non aggiungere categorie o flags non ammessi.
// `.trim();

// /** ───────────────────────────────────────────────────────────────
//  *  HELPERS
//  *  ─────────────────────────────────────────────────────────────── */
// function getExt(name?: string | null): string {
//   if (!name) return '';
//   const dot = name.lastIndexOf('.');
//   return dot >= 0 ? name.slice(dot).toLowerCase() : '';
// }
// function isAllowedExt(ext: string) {
//   return (ALLOWED_EXT as readonly string[]).includes(ext);
// }
// async function uploadPdfToGemini(
//   fileManager: GoogleAIFileManager,
//   file: File,
//   buffer: Buffer,
//   extension: string
// ) {
//   const tempPath = join(
//     tmpdir(),
//     `housewise-${randomUUID()}${extension || '.pdf'}`
//   );
//   await fs.writeFile(tempPath, buffer);
//   try {
//     const upload = await fileManager.uploadFile(tempPath, {
//       mimeType: file.type || 'application/pdf',
//       displayName: file.name || 'preventivo.pdf',
//     });
//     return upload.file; // { uri, mimeType, ... }
//   } finally {
//     await fs.unlink(tempPath).catch(() => {});
//   }
// }
// function trimTextPayload(input: string, limit = 100_000) {
//   if (input.length <= limit) return input;
//   return `${input.slice(0, limit)}\n\n[...troncato dopo ${limit} caratteri]`;
// }
// function ensureStructuredResult(parsed: unknown): AiStructuredResponse {
//   if (!parsed || typeof parsed !== 'object') {
//     throw new Error('Risposta AI non valida: formato inatteso');
//   }
//   const candidate = parsed as Record<string, unknown>;
//   if (!Array.isArray(candidate.items)) {
//     throw new Error("Risposta AI non valida: campo 'items' mancante");
//   }
//   if (
//     !candidate.per_source_summary ||
//     typeof candidate.per_source_summary !== 'object'
//   ) {
//     throw new Error(
//       "Risposta AI non valida: campo 'per_source_summary' mancante"
//     );
//   }
//   return {
//     source_label: candidate.source_label as string | undefined,
//     file_name: candidate.file_name as string | undefined,
//     items: candidate.items as AiNormalizedItem[],
//     per_source_summary: candidate.per_source_summary as AiPerSourceSummary,
//     notes: candidate.notes as string[] | undefined,
//   };
// }
// function coerceNumber(v: any): number | null {
//   if (v === null || v === undefined) return null;
//   if (typeof v === 'number') return Number.isFinite(v) ? v : null;
//   if (typeof v === 'string') {
//     const n = Number(v.replace(',', '.'));
//     return Number.isFinite(n) ? n : null;
//   }
//   return null;
// }
// function has(text: string | undefined, ...words: string[]): boolean {
//   if (!text) return false;
//   const t = text.toLowerCase();
//   return words.some((w) => t.includes(w.toLowerCase()));
// }

// /** Sanificazione items: categorie fuori ontologia, campi numerici e descrizione_normalizzata */
// function sanitizeItems(items: AiNormalizedItem[]): AiNormalizedItem[] {
//   const allowed = new Set(CATEGORIES as readonly string[]);
//   return (items || []).map((it) => {
//     let cat = (it?.categoria as string) || 'unknown';

//     // mapping categorie errate/comuni
//     if (!allowed.has(cat)) {
//       const raw = (it?.descrizione_originale || '').toLowerCase();
//       // smontaggio sanitari → demolizioni/smaltimenti
//       if (
//         has(raw, 'smontaggio sanitari') ||
//         (has(raw, 'smontaggio') && has(raw, 'sanitari'))
//       ) {
//         cat = 'demolizioni_smaltimenti';
//       } else if (
//         has(
//           raw,
//           'muratur',
//           'foratell',
//           'tramezz',
//           'muro doccia',
//           'cassett',
//           'geberit'
//         )
//       ) {
//         // opere murarie/tramezzi → altri_extra (finché non introduci categoria dedicata)
//         cat = 'altri_extra';
//       } else {
//         cat = 'altri_extra';
//       }
//     }

//     const importo = coerceNumber(it?.importo_euro);
//     const quantita = coerceNumber(it?.quantita);
//     const prezzoUnit = coerceNumber(it?.prezzo_unitario_eur);

//     let dn = it?.descrizione_normalizzata || '';
//     if (!dn.trim()) {
//       const words = String(it?.descrizione_originale || '')
//         .trim()
//         .split(/\s+/);
//       dn = words.slice(0, 15).join(' ');
//       if (words.length > 15) dn += '…';
//     }

//     return {
//       ...it,
//       categoria: cat as Category,
//       importo_euro: importo,
//       quantita,
//       prezzo_unitario_eur: prezzoUnit,
//       descrizione_normalizzata: dn,
//     };
//   });
// }

// /** Inizializza un Record<categoria, number> a 0 */
// function makeEmptyTotals(): Record<Category, number> {
//   const totals = {} as Record<Category, number>;
//   for (const c of CATEGORIES) totals[c] = 0;
//   return totals;
// }
// /** Somma importi per categoria dagli items (ignorando null/NaN) */
// function computeTotalsFromItems(
//   items: AiNormalizedItem[]
// ): Record<Category, number> {
//   const totals = makeEmptyTotals();
//   for (const it of items ?? []) {
//     const cat = it?.categoria as Category | undefined;
//     const value = coerceNumber(it?.importo_euro);
//     if (
//       cat &&
//       (CATEGORIES as readonly string[]).includes(cat) &&
//       value !== null
//     ) {
//       totals[cat] = totals[cat] + value;
//     }
//   }
//   return totals;
// }
// /** Somma di tutti i totali per categoria */
// function sumTotals(totals: Record<Category, number>): number {
//   return Object.values(totals).reduce(
//     (a, b) => a + (Number.isFinite(b) ? b : 0),
//     0
//   );
// }
// /** Euristiche minime per riempire inclusioni/esclusioni se vuote e NON affermare fornitura senza parole chiave */
// function enrichBulletsIfEmpty(
//   summary: AiPerSourceSummary,
//   items: AiNormalizedItem[]
// ) {
//   const inclusioni = Array.isArray(summary.inclusioni_evidenti)
//     ? [...summary.inclusioni_evidenti]
//     : [];
//   const esclusioni = Array.isArray(summary.esclusioni_evidenti)
//     ? [...summary.esclusioni_evidenti]
//     : [];

//   // Inclusioni: SOLO se ci sono chiavi evidenti (smaltimento/tinteggiatura/faretti)
//   if (!inclusioni.length) {
//     if (items.some((i) => has(i.descrizione_originale, 'smaltimento')))
//       inclusioni.push('Smaltimento incluso');
//     if (
//       items.some((i) =>
//         has(i.descrizione_originale, 'tinteggiatura', 'imbiancatura')
//       )
//     )
//       inclusioni.push('Tinteggiatura inclusa');
//     if (items.some((i) => has(i.descrizione_originale, 'faretti')))
//       inclusioni.push('Illuminazione/parete doccia inclusa');
//   }

//   // Esclusioni generiche se flags suggeriscono buchi informativi
//   if (!esclusioni.length) {
//     if (
//       items.some((i) => (i.flags ?? []).includes('marca_materiale_mancante'))
//     ) {
//       esclusioni.push('Marche/materiali non specificati');
//     }
//     if (items.some((i) => (i.flags ?? []).includes('quantita_non_chiara'))) {
//       esclusioni.push('Quantità non definite con precisione');
//     }
//   }

//   summary.inclusioni_evidenti = inclusioni;
//   summary.esclusioni_evidenti = esclusioni;
// }
// /** Reconcile lato server: corregge totali_per_categoria e stima_totale_documento */
// function reconcileSummary(structured: AiStructuredResponse) {
//   const items = Array.isArray(structured.items) ? structured.items : [];
//   const computedTotals = computeTotalsFromItems(items);
//   const existingTotals =
//     structured.per_source_summary.totali_per_categoria ?? {};

//   const mergedTotals = makeEmptyTotals();
//   for (const category of CATEGORIES) {
//     const aiValue = Number(existingTotals[category]);
//     const computedValue = computedTotals[category];
//     if (Number.isFinite(computedValue)) {
//       mergedTotals[category] = computedValue;
//     } else if (Number.isFinite(aiValue)) {
//       mergedTotals[category] = aiValue;
//     } else {
//       mergedTotals[category] = 0;
//     }
//   }

//   const fixedTotal = sumTotals(mergedTotals);

//   structured.per_source_summary.totali_per_categoria = mergedTotals;
//   structured.per_source_summary.stima_totale_documento = fixedTotal;
//   structured.per_source_summary.inclusioni_evidenti =
//     structured.per_source_summary.inclusioni_evidenti ?? [];
//   structured.per_source_summary.esclusioni_evidenti =
//     structured.per_source_summary.esclusioni_evidenti ?? [];
//   structured.per_source_summary.checklist_mancanze =
//     structured.per_source_summary.checklist_mancanze ?? [];
//   structured.per_source_summary.punti_ambigui =
//     structured.per_source_summary.punti_ambigui ?? [];

//   enrichBulletsIfEmpty(structured.per_source_summary, items);
// }

// function pairsToRecord(
//   pairs: Array<{ categoria: string; totale: number }>
// ): Record<Category, number> {
//   const rec = {} as Record<Category, number>;
//   for (const c of CATEGORIES) rec[c] = 0;
//   for (const p of pairs || []) {
//     if (
//       (CATEGORIES as readonly string[]).includes(p.categoria) &&
//       Number.isFinite(p.totale)
//     ) {
//       rec[p.categoria as Category] += p.totale;
//     }
//   }
//   return rec;
// }

// /** ───────────────────────────────────────────────────────────────
//  *  ROUTE
//  *  ─────────────────────────────────────────────────────────────── */
// export async function POST(req: NextRequest) {
//   const apiKey = process.env.GEMINI_API_KEY;
//   if (!apiKey) {
//     return NextResponse.json(
//       { error: 'GEMINI_API_KEY non configurata' },
//       { status: 500 }
//     );
//   }

//   try {
//     const form = await req.formData();
//     const file = form.get('file');
//     const sourceLabel =
//       ((form.get('source_label') as string) || 'A').trim() || 'A';

//     if (!(file instanceof File)) {
//       return NextResponse.json(
//         { error: "Nessun file ricevuto (campo 'file')" },
//         { status: 400 }
//       );
//     }

//     const ext = getExt(file.name);
//     if (!isAllowedExt(ext)) {
//       return NextResponse.json(
//         {
//           error: `Estensione non supportata: ${
//             ext || '(nessuna)'
//           } — usa: ${ALLOWED_EXT.join(', ')}`,
//         },
//         { status: 415 }
//       );
//     }

//     if (file.size > MAX_FILE_BYTES) {
//       const sizeMb = (file.size / 1024 / 1024).toFixed(1);
//       const maxMb = (MAX_FILE_BYTES / 1024 / 1024).toFixed(0);
//       return NextResponse.json(
//         {
//           error: `File troppo grande (${sizeMb}MB). Dimensione massima ${maxMb}MB`,
//         },
//         { status: 413 }
//       );
//     }

//     const genAI = new GoogleGenerativeAI(apiKey);
//     const fileManager = new GoogleAIFileManager(apiKey);

//     const arrayBuffer = await file.arrayBuffer();
//     const buffer = Buffer.from(arrayBuffer);

//     const parts: Part[] = [
//       { text: SYSTEM },
//       { text: ONTOLOGY },
//       { text: INSTRUCTIONS },
//       { text: `SOURCE_LABEL=${sourceLabel}` },
//     ];

//     if (ext === '.pdf') {
//       const uploaded = await uploadPdfToGemini(fileManager, file, buffer, ext);
//       parts.push({
//         fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType },
//       });
//       parts.push({ text: `FILE_NAME=${file.name}` });
//     } else if (ext === '.txt') {
//       const raw = buffer.toString('utf8');
//       const lines = parseTextToLines(raw);
//       parts.push({
//         text: `CONTENUTO_FILE (${file.name}):\n\n${trimTextPayload(
//           lines.join('\n')
//         )}`,
//       });
//     } else if (ext === '.csv' || ext === '.xlsx') {
//       const lines = parseXlsxOrCsvToLines(buffer, file.name);
//       parts.push({
//         text: `CONTENUTO_FILE (${file.name}):\n\n${trimTextPayload(
//           lines.join('\n')
//         )}`,
//       });
//     } else {
//       parts.push({
//         text: `CONTENUTO_FILE (${file.name}):\n\n${trimTextPayload(
//           buffer.toString('utf8')
//         )}`,
//       });
//     }

//     const model = genAI.getGenerativeModel({
//       model: 'gemini-1.5-pro',
//       generationConfig: {
//         temperature: 0.1,
//         responseMimeType: 'application/json',
//         responseSchema, // forza JSON conformante allo schema
//       },
//     });

//     const userContent: Content = { role: 'user', parts };
//     const result = await model.generateContent({ contents: [userContent] });

//     const json = result.response?.text() ?? '{}';
//     let parsed: any;
//     try {
//       parsed = JSON.parse(json);
//     } catch {
//       const cleaned = json.replace(/^[^\{]*\{/, '{').replace(/\}[^\}]*$/, '}');
//       parsed = JSON.parse(cleaned);
//     }

//     const structured = ensureStructuredResult(parsed);

//     if (Array.isArray(structured.per_source_summary?.totali_per_categoria)) {
//       const rec = pairsToRecord(
//         structured.per_source_summary.totali_per_categoria as any
//       );
//       structured.per_source_summary.totali_per_categoria = rec as any;
//     }

//     // Meta utili
//     structured.source_label ??= sourceLabel;
//     structured.file_name ??= (file as File).name;

//     // Sanitize items (categorie non valide, numeri, descrizione_normalizzata fallback)
//     structured.items = sanitizeItems(structured.items);

//     // Reconcile totali/stima + bullets minimi
//     reconcileSummary(structured);

//     return NextResponse.json(structured);
//   } catch (error) {
//     console.error('[/api/ai/normalize] error', error);
//     const message = error instanceof Error ? error.message : 'Errore';
//     return NextResponse.json({ error: message }, { status: 500 });
//   }
// }

// app/api/ai/normalize/route.ts
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenerativeAI,
  type Content,
  type Part,
} from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/files';
import { parseTextToLines } from '@/lib/parsers/text';
import { parseXlsxOrCsvToLines } from '@/lib/parsers/xlsx';

export const runtime = 'nodejs';

const ALLOWED_EXT = ['.pdf', '.txt', '.csv', '.xlsx'] as const;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

const CATEGORIES = [
  'demolizioni_smaltimenti',
  'impianto_elettrico',
  'impianto_idrico_sanitario',
  'impianto_termico_riscaldamento_caldaia',
  'gas',
  'pavimenti_rivestimenti_massetti',
  'bagno_forniture_sanitari_rubinetteria',
  'cucina_lavori_idrici_elettrici',
  'porte_interne',
  'serramenti_infissi',
  'pittura_cartongesso_controssoffitti',
  'pratiche_tecniche_permessi_dico',
  'condizionamento_ventilazione',
  'impianto_fotovoltaico_pannelli',
  'batteria_accumulo',
  'inverter_fotovoltaico',
  'pratiche_autorizzative_fotovoltaico_gse',
  'pompe_di_calore',
  'altri_extra',
  'unknown',
] as const;

const FLAGS = [
  'marca_materiale_mancante',
  'dico_mancante',
  'smaltimento_non_menzionato',
  'quantita_non_chiara',
  'esclusioni_presenti',
  'garanzia_non_specificata',
  'pratiche_autorizzative_non_menzionate',
] as const;

/**
 * Schema di risposta AI (structured outputs).
 * Nota: campi quantita/unita/prezzo_unitario_eur sono opzionali ma utili per spiegare i calcoli.
 */
type Category = (typeof CATEGORIES)[number];
type Flag = (typeof FLAGS)[number];

interface AiNormalizedItem {
  source_index?: number;
  page?: number;
  descrizione_originale?: string;
  descrizione_normalizzata?: string;
  categoria?: Category;
  importo_euro?: number | null;
  quantita?: number | null;
  unita?: string | null;
  prezzo_unitario_eur?: number | null;
  flags?: Flag[];
  confidence_ai?: number;
}

interface AiPerSourceSummary {
  totali_per_categoria?: Record<string, number>;
  inclusioni_evidenti?: string[];
  esclusioni_evidenti?: string[];
  checklist_mancanze?: string[];
  punti_ambigui?: string[];
  stima_totale_documento?: number | null;
}

interface AiStructuredResponse {
  source_label?: string;
  file_name?: string;
  items: AiNormalizedItem[];
  per_source_summary: AiPerSourceSummary;
  notes?: string[];
}

const SYSTEM = `
Sei un normalizzatore di voci di preventivi per ristrutturazioni e impianti in Italia.
NON inventare voci, quantità o prezzi. Se incerto → categoria "unknown".
Restituisci SOLO JSON conforme allo schema. descrizione_normalizzata ≤ 15 parole.
Regole flag:
- "esclusioni_presenti" se la riga contiene "escluso", "non incluso", "a carico del cliente".
- "marca_materiale_mancante" se trovi "fornitura" ma non "marca"/"modello".
- Per FV/batteria/inverter/PdC senza pratiche citate → "pratiche_autorizzative_non_menzionate".
- Se non emergono quantità tipiche (punti luce, kWp, kWh, n./pz/cifre) → "quantita_non_chiara".
Linee guida categorie:
- "opere murarie"/"tramezzi"/"muri doccia"/"cassette incasso" NON sono "sanitari": se non c'è categoria dedicata, usare "altri_extra" o "pittura_cartongesso_controssoffitti".
`.trim();

const ONTOLOGY = `
Categorie ammesse:
${CATEGORIES.join(', ')}.
Flags ammessi:
${FLAGS.join(', ')}.
`.trim();

const INSTRUCTIONS = `
1) Estrai tutte le voci rilevanti: descrizione_originale, categoria (una sola), importo_euro (se presente), flags e confidence_ai.
   Quando disponibili, estrai anche quantita, unita e prezzo_unitario_eur (opzionali).
2) Compila per_source_summary:
   - totali_per_categoria: somma importi per categoria coerente con gli items. Se il documento è "a corpo", imputa il totale a "altri_extra" e scrivilo nelle note.
   - inclusioni_evidenti / esclusioni_evidenti: inserisci SEMPRE 3–6 bullet totali (se deducibili), es. "smaltimento incluso", "sanitari esclusi".
   - checklist_mancanze: tempi non indicati, marche non specificate, quantità non chiare, DiCo assenti, ecc.
   - punti_ambigui: elementi non chiari da chiedere all'impresa.
   - stima_totale_documento: importo a corpo o somma delle voci (deve essere coerente con la somma degli items che hanno importo).
3) Coerenza: i totali per categoria DEVONO corrispondere alla somma degli items nella stessa categoria.
4) Non scrivere testo fuori dal JSON. Non aggiungere categorie o flags non ammessi.
`.trim();

function getExt(name?: string | null): string {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function isAllowedExt(ext: string) {
  return (ALLOWED_EXT as readonly string[]).includes(ext);
}

async function uploadPdfToGemini(
  fileManager: GoogleAIFileManager,
  file: File,
  buffer: Buffer,
  extension: string
) {
  const tempPath = join(
    tmpdir(),
    `housewise-${randomUUID()}${extension || '.pdf'}`
  );
  await fs.writeFile(tempPath, buffer);
  try {
    const upload = await fileManager.uploadFile(tempPath, {
      mimeType: file.type || 'application/pdf',
      displayName: file.name || 'preventivo.pdf',
    });
    return upload.file; // { uri, mimeType, ... }
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

function trimTextPayload(input: string, limit = 100_000) {
  if (input.length <= limit) return input;
  return `${input.slice(0, limit)}\n\n[...troncato dopo ${limit} caratteri]`;
}

function ensureStructuredResult(parsed: unknown): AiStructuredResponse {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Risposta AI non valida: formato inatteso');
  }
  const candidate = parsed as Record<string, unknown>;
  if (!Array.isArray(candidate.items)) {
    throw new Error("Risposta AI non valida: campo 'items' mancante");
  }
  if (
    !candidate.per_source_summary ||
    typeof candidate.per_source_summary !== 'object'
  ) {
    throw new Error(
      "Risposta AI non valida: campo 'per_source_summary' mancante"
    );
  }
  return {
    source_label: candidate.source_label as string | undefined,
    file_name: candidate.file_name as string | undefined,
    items: candidate.items as AiNormalizedItem[],
    per_source_summary: candidate.per_source_summary as AiPerSourceSummary,
    notes: candidate.notes as string[] | undefined,
  };
}

/** Inizializza un Record<categoria, number> a 0 */
function makeEmptyTotals(): Record<Category, number> {
  const totals = {} as Record<Category, number>;
  for (const c of CATEGORIES) totals[c] = 0;
  return totals;
}

/** Somma importi per categoria dagli items (ignorando null/NaN) */
function computeTotalsFromItems(
  items: AiNormalizedItem[]
): Record<Category, number> {
  const totals = makeEmptyTotals();
  for (const it of items ?? []) {
    const cat = it?.categoria;
    const value = it?.importo_euro;
    if (
      cat &&
      CATEGORIES.includes(cat) &&
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      totals[cat] = totals[cat] + value;
    }
  }
  return totals;
}

/** Somma di tutti i totali per categoria */
function sumTotals(totals: Record<Category, number>): number {
  return Object.values(totals).reduce(
    (a, b) => a + (Number.isFinite(b) ? b : 0),
    0
  );
}

/** Euristiche minime per riempire inclusioni/esclusioni se vuote */
function enrichBulletsIfEmpty(
  summary: AiPerSourceSummary,
  items: AiNormalizedItem[]
) {
  const inclusioni = Array.isArray(summary.inclusioni_evidenti)
    ? [...summary.inclusioni_evidenti]
    : [];
  const esclusioni = Array.isArray(summary.esclusioni_evidenti)
    ? [...summary.esclusioni_evidenti]
    : [];

  const lower = (s: string) => s.toLowerCase();

  // Inclusioni di comodo
  if (!inclusioni.length) {
    if (
      items.some((i) =>
        lower(i.descrizione_originale ?? '').includes('smaltimento')
      )
    ) {
      inclusioni.push('Smaltimento incluso');
    }
    if (
      items.some((i) =>
        lower(i.descrizione_originale ?? '').includes('tinteggiatura')
      )
    ) {
      inclusioni.push('Tinteggiatura inclusa');
    }
    if (
      items.some((i) =>
        lower(i.descrizione_originale ?? '').includes('faretti')
      )
    ) {
      inclusioni.push('Illuminazione/parete doccia inclusa');
    }
  }

  // Esclusioni di comodo (se troviamo hint)
  if (!esclusioni.length) {
    if (
      items.some((i) => (i.flags ?? []).includes('marca_materiale_mancante'))
    ) {
      esclusioni.push('Marche/materiali non specificati');
    }
    if (items.some((i) => (i.flags ?? []).includes('quantita_non_chiara'))) {
      esclusioni.push('Quantità non definite con precisione');
    }
  }

  summary.inclusioni_evidenti = inclusioni;
  summary.esclusioni_evidenti = esclusioni;
}

/** Reconcile lato server: corregge totali_per_categoria e stima_totale_documento */
function reconcileSummary(structured: AiStructuredResponse) {
  const items = Array.isArray(structured.items) ? structured.items : [];
  const computedTotals = computeTotalsFromItems(items);
  const existingTotals =
    structured.per_source_summary.totali_per_categoria ?? {};

  const mergedTotals = makeEmptyTotals();
  for (const category of CATEGORIES) {
    const aiValue = Number(existingTotals[category]);
    const computedValue = computedTotals[category];
    if (Number.isFinite(computedValue)) {
      mergedTotals[category] = computedValue;
    } else if (Number.isFinite(aiValue)) {
      mergedTotals[category] = aiValue;
    } else {
      mergedTotals[category] = 0;
    }
  }

  const fixedTotal = sumTotals(mergedTotals);

  structured.per_source_summary.totali_per_categoria = mergedTotals;
  structured.per_source_summary.stima_totale_documento = fixedTotal;
  structured.per_source_summary.inclusioni_evidenti =
    structured.per_source_summary.inclusioni_evidenti ?? [];
  structured.per_source_summary.esclusioni_evidenti =
    structured.per_source_summary.esclusioni_evidenti ?? [];
  structured.per_source_summary.checklist_mancanze =
    structured.per_source_summary.checklist_mancanze ?? [];
  structured.per_source_summary.punti_ambigui =
    structured.per_source_summary.punti_ambigui ?? [];

  enrichBulletsIfEmpty(structured.per_source_summary, items);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY non configurata' },
      { status: 500 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    const sourceLabel =
      ((form.get('source_label') as string) || 'A').trim() || 'A';

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Nessun file ricevuto (campo 'file')" },
        { status: 400 }
      );
    }

    const ext = getExt(file.name);
    if (!isAllowedExt(ext)) {
      return NextResponse.json(
        {
          error: `Estensione non supportata: ${
            ext || '(nessuna)'
          }. Usa: ${ALLOWED_EXT.join(', ')}`,
        },
        { status: 415 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      const maxMb = (MAX_FILE_BYTES / 1024 / 1024).toFixed(0);
      return NextResponse.json(
        {
          error: `File troppo grande (${sizeMb}MB). Dimensione massima ${maxMb}MB`,
        },
        { status: 413 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const fileManager = new GoogleAIFileManager(apiKey);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parts: Part[] = [
      { text: SYSTEM },
      { text: ONTOLOGY },
      { text: INSTRUCTIONS },
      { text: `SOURCE_LABEL=${sourceLabel}` },
    ];

    if (ext === '.pdf') {
      const uploaded = await uploadPdfToGemini(fileManager, file, buffer, ext);
      parts.push({
        fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType },
      });
      parts.push({ text: `FILE_NAME=${file.name}` });
    } else if (ext === '.txt') {
      const raw = buffer.toString('utf8');
      const lines = parseTextToLines(raw);
      parts.push({
        text: `CONTENUTO_FILE (${file.name}):\n\n${trimTextPayload(
          lines.join('\n')
        )}`,
      });
    } else if (ext === '.csv' || ext === '.xlsx') {
      const lines = parseXlsxOrCsvToLines(buffer, file.name);
      parts.push({
        text: `CONTENUTO_FILE (${file.name}):\n\n${trimTextPayload(
          lines.join('\n')
        )}`,
      });
    } else {
      parts.push({
        text: `CONTENUTO_FILE (${file.name}):\n\n${trimTextPayload(
          buffer.toString('utf8')
        )}`,
      });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro', // pro consigliato per parsing PDF complessi/OCR
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const userContent: Content = { role: 'user', parts };
    const result = await model.generateContent({ contents: [userContent] });

    const json = result.response?.text() ?? '{}';
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      const cleaned = json.replace(/^[^\{]*\{/, '{').replace(/\}[^\}]*$/, '}');
      parsed = JSON.parse(cleaned);
    }

    const structured = ensureStructuredResult(parsed);

    // aggiungi meta utili
    structured.source_label ??= sourceLabel;
    structured.file_name ??= (file as File).name;

    // RECONCILE lato server (corregge totali e stima totale; bullets se vuoti)
    reconcileSummary(structured);

    return NextResponse.json(structured);
  } catch (error) {
    console.error('[/api/ai/normalize] error', error);
    const message = error instanceof Error ? error.message : 'Errore';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

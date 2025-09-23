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

const SYSTEM = `
Sei un normalizzatore di voci di preventivi per ristrutturazioni e impianti in Italia.
NON inventare voci, quantità o prezzi. Se incerto → categoria "unknown".
Restituisci SOLO JSON conforme allo schema. descrizione_normalizzata ≤ 15 parole.
Regole flag:
- "esclusioni_presenti" se la riga contiene "escluso", "non incluso", "a carico del cliente".
- "marca_materiale_mancante" se trovi "fornitura" ma non "marca"/"modello".
- Per FV/batteria/inverter/PdC senza pratiche citate → "pratiche_autorizzative_non_menzionate".
- Se non emergono quantità tipiche (punti luce, kWp, kWh, n./pz/cifre) → "quantita_non_chiara".
`.trim();

const ONTOLOGY = `
Categorie ammesse:
${CATEGORIES.join(', ')}.
Flags ammessi:
${FLAGS.join(', ')}.
`.trim();

const INSTRUCTIONS = `
1) Estrai tutte le voci rilevanti: descrizione_originale, categoria (una sola), importo_euro (se presente), flags e confidence_ai.
2) Compila anche per_source_summary:
   - totali_per_categoria: somma importi per categoria. Se il documento è "a corpo", imputa il totale a "altri_extra" e spiega nelle note.
   - inclusioni_evidenti / esclusioni_evidenti: frasi semplici (es. "sanitari inclusi", "pavimenti esclusi").
   - checklist_mancanze: tempi non indicati, marche non specificate, quantità non chiare, DiCo assenti, ecc.
   - punti_ambigui: elementi non chiari da chiedere all'impresa.
   - stima_totale_documento: importo a corpo o somma delle voci.
3) Non scrivere testo fuori dal JSON. Non aggiungere categorie o flags non ammessi.
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
    return upload.file;
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

function trimTextPayload(input: string, limit = 100_000) {
  if (input.length <= limit) return input;
  return `${input.slice(0, limit)}\n\n[...troncato dopo ${limit} caratteri]`;
}

function ensureStructuredResult(parsed: unknown) {
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

  return candidate;
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
      model: 'gemini-1.5-flash-latest', // "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const userContent: Content = { role: 'user', parts };

    const result = await model.generateContent({
      contents: [userContent],
    });

    const json = result.response?.text() ?? '{}';
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      const cleaned = json.replace(/^[^\{]*\{/, '{').replace(/\}[^\}]*$/, '}');
      parsed = JSON.parse(cleaned);
    }

    const structured = ensureStructuredResult(parsed);

    structured.source_label ??= sourceLabel;
    structured.file_name ??= file.name;

    return NextResponse.json(structured);
  } catch (error) {
    console.error('[/api/ai/normalize] error', error);
    const message = error instanceof Error ? error.message : 'Errore';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

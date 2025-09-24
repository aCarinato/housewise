import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/files';
import { parsePdfToLines } from '@/lib/parsers/pdf';

export const runtime = 'nodejs';

const ALLOWED_EXT = ['.pdf'] as const;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const DEFAULT_SUPPLIER_QUESTIONS = [
  'Chiedere il dettaglio completo delle lavorazioni e delle quantità incluse nel prezzo a corpo',
  'Richiedere conferma scritta su smaltimenti, pratiche e garanzie comprese',
  'Verificare tempi di esecuzione, eventuali penali e condizioni di pagamento',
];

const VALIDATION_SYSTEM_PROMPT = `
Sei un assistente tecnico che valuta testi per capire se appartengono a un preventivo edilizio (ristrutturazioni, impianti, serramenti, ecc.).
Rispondi SOLO in JSON con le chiavi: ok (boolean) e reason (stringa molto breve in italiano).
Devi restituire ok=true solo se il testo suggerisce chiaramente un preventivo per lavori/impianti di edilizia abitativa o simili.
Se il testo è un altro tipo di documento o non è chiaro, rispondi ok=false e motiva sinteticamente.
`.trim();

const KIND_ORDER = ['risk', 'missing', 'exclusion', 'ambiguity', 'inclusion', 'note'] as const;
type FindingKind = (typeof KIND_ORDER)[number];
type Status = 'present' | 'absent' | 'unclear';
type Importance = 'high' | 'medium' | 'low';

type EvidenceItem = { text: string; page?: number };

type Finding = {
  id: string;
  label: string;
  kind: FindingKind;
  area?: string;
  status?: Status;
  importance?: Importance;
  evidence: EvidenceItem[];
  amount_eur?: number | null;
  suggestion?: string | null;
  confidence_ai?: number;
};

type EvaluateResponse = {
  source_label: string;
  file_name: string;
  overview: string;
  findings: Finding[];
  summary: {
    total_detected: number | null;
    pages_detected: number | null;
  };
  inclusioni_evidenti: string[];
  esclusioni_evidenti: string[];
  checklist_mancanze: string[];
  punti_ambigui: string[];
  supplier_questions: string[];
  evidence_by_item?: Record<string, EvidenceItem[]>;
  meta: { model: string; warnings?: string[] };
};

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
  extension: string,
) {
  const tempPath = join(tmpdir(), `housewise-${randomUUID()}${extension || '.pdf'}`);
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

function parseJsonStrictish(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {}
  const unwrapped = s.replace(/^```json\s*|\s*```$/g, '');
  try {
    return JSON.parse(unwrapped);
  } catch {}
  const start = unwrapped.indexOf('{');
  const end = unwrapped.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const core = unwrapped.slice(start, end + 1);
    return JSON.parse(core);
  }
  throw new Error('Risposta AI non è JSON valido');
}

function clampLen(s: string, max = 160) {
  if (!s) return s;
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normKind(value: unknown): FindingKind {
  const lower = String(value ?? '').toLowerCase();
  if (/risk|risch/.test(lower)) return 'risk';
  if (/missing|mancan/.test(lower)) return 'missing';
  if (/exclu|esclus|non incluso/.test(lower)) return 'exclusion';
  if (/ambig|incert/.test(lower)) return 'ambiguity';
  if (/inclus|compres|fornit|acquist/.test(lower)) return 'inclusion';
  return 'note';
}

function normStatus(value: unknown): Status | undefined {
  const lower = String(value ?? '').toLowerCase();
  if (lower === 'present' || /\bsi\b|ok|true/.test(lower)) return 'present';
  if (lower === 'absent' || /\bno\b|false/.test(lower)) return 'absent';
  if (lower === 'unclear' || /non chiaro|dubb/.test(lower)) return 'unclear';
  return undefined;
}

function normImportance(value: unknown): Importance {
  const lower = String(value ?? '').toLowerCase();
  if (lower === 'high' || /alto|alta|critico/.test(lower)) return 'high';
  if (lower === 'low' || /basso|bassa/.test(lower)) return 'low';
  return 'medium';
}

function sanitizeEvidence(entries: unknown, limit = 8): EvidenceItem[] {
  if (!Array.isArray(entries)) return [];
  const dedup = new Map<string, EvidenceItem>();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const text = clampLen(String(raw.text ?? '').trim(), 180);
    if (!text) continue;
    const page = typeof raw.page === 'number' && Number.isFinite(raw.page) ? raw.page : undefined;
    const key = `${text}#${page ?? ''}`;
    if (!dedup.has(key)) dedup.set(key, { text, page });
  }
  return Array.from(dedup.values()).slice(0, limit);
}

function sanitizeFindings(entries: unknown): Finding[] {
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const label = clampLen(String(raw.label ?? '').trim(), 140);
    if (!label) continue;
    const kind = normKind(raw.kind);
    const status = normStatus(raw.status);
    const importance = normImportance(raw.importance);
    const amount = coerceNumber(raw.amount_eur);
    const area = typeof raw.area === 'string' ? raw.area : undefined;
    const evidence = sanitizeEvidence(raw.evidence);
    const suggestion = raw.suggestion != null ? clampLen(String(raw.suggestion), 200) : null;
    const confidence = typeof raw.confidence_ai === 'number' ? raw.confidence_ai : undefined;
    const key = `${label.toLowerCase()}|${kind}|${area ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: randomUUID(),
      label,
      kind,
      area,
      status,
      importance,
      evidence,
      amount_eur: amount,
      suggestion,
      confidence_ai: confidence,
    });
  }
  out.sort((a, b) => {
    const kindDelta = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (kindDelta !== 0) return kindDelta;
    const impOrder: Importance[] = ['high', 'medium', 'low'];
    const impDelta = impOrder.indexOf(a.importance ?? 'medium') - impOrder.indexOf(b.importance ?? 'medium');
    if (impDelta !== 0) return impDelta;
    return a.label.localeCompare(b.label);
  });
  for (const finding of out) {
    if ((finding.kind === 'inclusion' || finding.kind === 'exclusion') && !finding.status) {
      finding.status = 'present';
    }
  }
  return out.slice(0, 200);
}

function sanitizeStringArray(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  const strings = value
    .map((item) => clampLen(String(item ?? '').trim(), 160))
    .filter(Boolean);
  return Array.from(new Set(strings)).slice(0, limit);
}

function sanitizeEvidenceMap(value: unknown): Record<string, EvidenceItem[]> {
  if (!value || typeof value !== 'object') return {};
  const map: Record<string, EvidenceItem[]> = {};
  for (const [key, entries] of Object.entries(value as Record<string, unknown>)) {
    const evidence = sanitizeEvidence(entries, 6);
    if (evidence.length > 0) {
      map[key] = evidence;
    }
  }
  return map;
}

function sanitizeOverview(value: unknown): string {
  const text = clampLen(String(value ?? '').trim(), 400);
  return text || 'Nessuna nota generale specificata dal modello.';
}

function sanitizeSupplierQuestions(value: unknown, fallbackSources: string[]): string[] {
  const base = sanitizeStringArray(value, 7);
  if (base.length >= 3) return base;

  const extras = fallbackSources.filter((item) => !base.includes(item)).slice(0, 5);
  const merged = [...base, ...extras];
  if (merged.length >= 3) {
    return merged.slice(0, 7);
  }
  const defaults = DEFAULT_SUPPLIER_QUESTIONS.filter((item) => !merged.includes(item));
  return [...merged, ...defaults].slice(0, 7);
}

async function validateQuoteWithAI(
  genAI: GoogleGenerativeAI,
  preview: string,
): Promise<{ ok: boolean; reason: string }> {
  const text = preview.trim();
  if (!text) {
    return { ok: false, reason: 'Documento vuoto o non leggibile.' };
  }

  const validator = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });

  const prompt = `Testo estratto (anteprima max 4000 caratteri):\n\n${text.slice(0, 4000)}`;
  const result = await validator.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: VALIDATION_SYSTEM_PROMPT },
          { text: prompt },
          { text: 'Rispondi in JSON: { "ok": true|false, "reason": "..." }' },
        ],
      },
    ],
  });

  const textResponse = result.response?.text() ?? '{}';
  try {
    const parsed = JSON.parse(textResponse) as { ok?: boolean; reason?: string };
    if (typeof parsed.ok === 'boolean') {
      return {
        ok: parsed.ok,
        reason:
          clampLen(String(parsed.reason ?? '').trim(), 150) ||
          'Il documento non sembra essere un preventivo edilizio.',
      };
    }
  } catch (error) {
    console.warn('validateQuoteWithAI JSON parse error', error);
  }

  return {
    ok: false,
    reason: 'Il documento non sembra essere un preventivo edilizio.',
  };
}

const SYSTEM = `
Sei un valutatore di preventivi di ristrutturazione (mercato italiano).
Devi analizzare un solo documento e restituire SOLO JSON.
Non inventare dati: usa solo quanto emerge dal documento. Se un'informazione manca, segnala status "unclear".
`.trim();

const INSTRUCTIONS = `
1) Estrai elementi chiave del preventivo (inclusioni, esclusioni, clausole, rischi, mancanze).
2) Produci JSON con campi: overview (2-3 frasi), findings[], inclusioni_evidenti[], esclusioni_evidenti[], checklist_mancanze[], punti_ambigui[], supplier_questions[] (cosa chiedere al fornitore), evidence_by_item.
3) Ogni finding deve contenere label, kind, evidence (snippet + pagina) e, se utile, un suggerimento pratico.
4) kind: uso restrittivo → inclusion/esclusion solo con evidenza testuale chiara; missing per elementi attesi ma assenti; ambiguity per testo vago; risk per criticità.
5) supplier_questions deve avere almeno 3 punti specifici su cosa chiarire con il fornitore.
6) Mantieni testo conciso (label ≤ 140 caratteri, evidence ≤ 180). Evita duplicati.
`.trim();

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY non configurata' }, { status: 500 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    const sourceLabel = 'A';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nessun file ricevuto (campo 'file')" }, { status: 400 });
    }

    const ext = getExt(file.name);
    if (!isAllowedExt(ext)) {
      return NextResponse.json(
        { error: `Estensione non supportata: ${ext || '(nessuna)'} (accetta: ${ALLOWED_EXT.join(', ')})` },
        { status: 415 },
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      const maxMb = (MAX_FILE_BYTES / 1024 / 1024).toFixed(0);
      return NextResponse.json(
        { error: `File troppo grande (${sizeMb}MB). Massimo consentito ${maxMb}MB` },
        { status: 413 },
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const fileManager = new GoogleAIFileManager(apiKey);

    const buffer = Buffer.from(await file.arrayBuffer());
    let previewLines: string[] = [];
    try {
      previewLines = await parsePdfToLines(buffer);
    } catch (error) {
      console.warn('Preview parsing failed', error);
    }

    const previewText = previewLines.slice(0, 200).join('\n');
    if (previewText.replace(/\s+/g, '').length >= 200) {
      const validation = await validateQuoteWithAI(genAI, previewText);
      if (!validation.ok) {
        return NextResponse.json(
          { error: validation.reason || 'Il documento non sembra essere un preventivo edilizio.' },
          { status: 400 },
        );
      }
    }

    const parts: Part[] = [{ text: SYSTEM }, { text: INSTRUCTIONS }, { text: `SOURCE_LABEL=${sourceLabel}` }];

    const uploaded = await uploadPdfToGemini(fileManager, file, buffer, ext);
    parts.push({ fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } });
    parts.push({ text: `FILE_NAME=${file.name}` });

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: { temperature: 0.0, responseMimeType: 'application/json' },
    });

    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    const json = result.response?.text() ?? '{}';
    const parsed = parseJsonStrictish(json);
    const root = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};

    const findings = sanitizeFindings(root.findings);
    const inclusioni = sanitizeStringArray(root.inclusioni_evidenti);
    const esclusioni = sanitizeStringArray(root.esclusioni_evidenti);
    const mancanze = sanitizeStringArray(root.checklist_mancanze);
    const ambigui = sanitizeStringArray(root.punti_ambigui);
    const fallbackRecommendations = sanitizeStringArray(root.consigli ?? root.recommendations, 8);
    const evidenceByItem = sanitizeEvidenceMap(root.evidence_by_item);
    const overview = sanitizeOverview(root.overview ?? root.overall_summary);
    const supplierQuestions = sanitizeSupplierQuestions(root.supplier_questions ?? fallbackRecommendations, [
      ...mancanze,
      ...ambigui,
    ]);

    const summaryRoot = root.summary && typeof root.summary === 'object' ? (root.summary as Record<string, unknown>) : {};
    const summary = {
      total_detected: coerceNumber(summaryRoot.total_detected),
      pages_detected: coerceNumber(summaryRoot.pages_detected),
    };

    const response: EvaluateResponse = {
      source_label: sourceLabel,
      file_name: file.name,
      overview,
      findings,
      summary,
      inclusioni_evidenti: inclusioni,
      esclusioni_evidenti: esclusioni,
      checklist_mancanze: mancanze,
      punti_ambigui: ambigui,
      supplier_questions: supplierQuestions,
      evidence_by_item: Object.keys(evidenceByItem).length ? evidenceByItem : undefined,
      meta: { model: 'gemini-1.5-pro' },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[/api/ai/evaluate] error', error);
    const message = error instanceof Error ? error.message : 'Errore';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

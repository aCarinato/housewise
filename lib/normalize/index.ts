import crypto from "node:crypto";
import { OntologiaEnum } from "./ontology";
import {
  CATEGORY_KEYWORDS,
  EXCLUSION_TOKENS,
  computeConfidence,
  extractEuroAmount,
  findLikelyCategory,
  hasAnyToken,
} from "./rules";
import { ItemFlag, NormalizedItem } from "../types";
import { normalizeSpaces, truncateWords } from "../utils/strings";

// Lightweight accent stripping to align comparisons with rule dictionaries.
const DIACRITIC_REGEX = /\p{Diacritic}/gu;
function toComparable(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIC_REGEX, "")
    .trim();
}

const DEMOLITION_CORE_KEYWORDS = CATEGORY_KEYWORDS[OntologiaEnum.demolizioni_smaltimenti]
  .filter((keyword) => !/smaltiment/i.test(keyword))
  .map((keyword) => toComparable(keyword));

const QUANTITY_TOKENS = [
  "punti",
  "kwp",
  "kwh",
  "n.",
  "n°",
  "pz",
  "pezzi",
  "nr",
  "punti luce",
  "metri",
  "mq",
  "mt",
  "coppi",
];

const PRATICHE_TOKENS = [
  "pratica",
  "pratiche",
  "connessione",
  "gse",
  "terna",
  "gaudi",
  "autorizzazione",
  "autorizzazioni",
  "e-distribuzione",
  "enel distribuzione",
];

const QUANTITY_SENSITIVE_CATEGORIES = new Set<OntologiaEnum>([
  OntologiaEnum.impianto_elettrico,
  OntologiaEnum.impianto_idrico_sanitario,
  OntologiaEnum.impianto_termico_riscaldamento_caldaia,
  OntologiaEnum.condizionamento_ventilazione,
  OntologiaEnum.impianto_fotovoltaico_pannelli,
  OntologiaEnum.inverter_fotovoltaico,
  OntologiaEnum.batteria_accumulo,
  OntologiaEnum.pompe_di_calore,
  OntologiaEnum.gas,
]);

const PRATICHE_SENSITIVE_CATEGORIES = new Set<OntologiaEnum>([
  OntologiaEnum.impianto_fotovoltaico_pannelli,
  OntologiaEnum.inverter_fotovoltaico,
  OntologiaEnum.batteria_accumulo,
  OntologiaEnum.pompe_di_calore,
]);

function ensureUniqueFlags(flags: ItemFlag[]): ItemFlag[] {
  return [...new Set(flags)];
}

// Normalizes raw textual lines into structured items with heuristics and flags.
export function normalizeLines(lines: string[]): NormalizedItem[] {
  const results: NormalizedItem[] = [];

  for (const rawLine of lines) {
    const cleaned = normalizeSpaces(rawLine ?? "");
    if (!cleaned || cleaned.length < 3) {
      continue;
    }

    const { category, hits } = findLikelyCategory(cleaned);
    const amount = extractEuroAmount(cleaned);

    const comparableLine = toComparable(cleaned);
    const lowerLine = cleaned.toLowerCase();

    const flags: ItemFlag[] = [];

    if (hasAnyToken(cleaned, EXCLUSION_TOKENS)) {
      flags.push("esclusioni_presenti");
    }

    if (category === OntologiaEnum.demolizioni_smaltimenti) {
      const mentionsDemolition = DEMOLITION_CORE_KEYWORDS.some((keyword) =>
        comparableLine.includes(keyword),
      );
      const mentionsSmaltimento = comparableLine.includes("smaltiment");
      if (mentionsDemolition && !mentionsSmaltimento) {
        flags.push("smaltimento_non_menzionato");
      }
    }

    if (/\bforniture?\b/.test(lowerLine) && !/(\bmarca\b|\bmodello\b)/.test(lowerLine)) {
      flags.push("marca_materiale_mancante");
    }

    if (QUANTITY_SENSITIVE_CATEGORIES.has(category)) {
      const hasNumbers = /\d/.test(cleaned);
      const hasQuantityToken = QUANTITY_TOKENS.some((token) => lowerLine.includes(token));
      if (!hasNumbers && !hasQuantityToken) {
        flags.push("quantita_non_chiara");
      }
    }

    if (PRATICHE_SENSITIVE_CATEGORIES.has(category)) {
      const mentionsPratiche = PRATICHE_TOKENS.some((token) => lowerLine.includes(token));
      if (!mentionsPratiche) {
        flags.push("pratiche_autorizzative_non_menzionate");
      }
    }

    const descrizioneNormalizzata = truncateWords(cleaned, 15);
    const confidence = computeConfidence({ keywordHits: hits, hasAmount: amount !== null });

    results.push({
      id: crypto.randomUUID(),
      descrizione_originale: cleaned,
      descrizione_normalizzata: descrizioneNormalizzata,
      categoria: category,
      importo_euro: amount,
      flags: ensureUniqueFlags(flags),
      confidence,
    });
  }

  return results;
}

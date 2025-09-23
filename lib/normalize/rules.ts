import { OntologiaEnum } from "./ontology";

// Keyword dictionaries used to score each category when scanning a line item.
export const CATEGORY_KEYWORDS: Record<OntologiaEnum, readonly string[]> = {
  [OntologiaEnum.demolizioni_smaltimenti]: [
    "demolizione",
    "demolizioni",
    "smaltimento",
    "macerie",
    "rimozione",
    "scarico",
    "trasporto in discarica",
    "abbattimento",
    "strip out",
    "taglio",
    "carico a discarica",
  ],
  [OntologiaEnum.impianto_elettrico]: [
    "impianto elettrico",
    "quadro elettrico",
    "punti luce",
    "linee elettriche",
    "salvavita",
    "cavi",
    "corrugati",
    "prese",
    "frutti",
    "impianto di terra",
    "cavidotti",
    "cassetta derivazione",
  ],
  [OntologiaEnum.impianto_idrico_sanitario]: [
    "impianto idrico",
    "sanitari",
    "scarichi",
    "tubazioni acqua",
    "multistrato",
    "collettore",
    "scarico wc",
    "scarico lavabo",
    "sifone",
    "acqua calda",
    "acqua fredda",
  ],
  [OntologiaEnum.impianto_termico_riscaldamento_caldaia]: [
    "riscaldamento",
    "caldaia",
    "termico",
    "radiatori",
    "termosifoni",
    "valvole",
    "cronotermostato",
    "pannelli radianti",
    "circolatore",
    "impianto termico",
  ],
  [OntologiaEnum.gas]: [
    "impianto gas",
    "tubazioni gas",
    "valvola gas",
    "prova tenuta gas",
    "contatore gas",
    "allaccio gas",
  ],
  [OntologiaEnum.pavimenti_rivestimenti_massetti]: [
    "posa",
    "pavimento",
    "pavimenti",
    "rivestimenti",
    "piastrelle",
    "gres",
    "massetto",
    "battiscopa",
    "laminato",
    "parquet",
    "rasopietra",
    "sottofondo",
  ],
  [OntologiaEnum.bagno_forniture_sanitari_rubinetteria]: [
    "fornitura sanitari",
    "rubinetteria",
    "box doccia",
    "wc",
    "bidet",
    "lavabo",
    "piatto doccia",
    "mobile bagno",
    "scarico doccia",
    "set bagno",
  ],
  [OntologiaEnum.cucina_lavori_idrici_elettrici]: [
    "cucina",
    "attacchi",
    "gas cucina",
    "lavello",
    "lavastoviglie",
    "predisposizione cucina",
    "forno",
    "piano cottura",
    "schienale",
  ],
  [OntologiaEnum.porte_interne]: [
    "porte interne",
    "controtelai",
    "cerniere",
    "maniglie",
    "sostituzione porte",
    "porta tamburata",
    "anta",
  ],
  [OntologiaEnum.serramenti_infissi]: [
    "infissi",
    "serramenti",
    "doppi vetri",
    "telaio",
    "monoblocco",
    "cassonetto",
    "vetrocamera",
    "oscuro",
    "persiane",
  ],
  [OntologiaEnum.pittura_cartongesso_controssoffitti]: [
    "pittura",
    "imbiancatura",
    "rasatura",
    "cartongesso",
    "controsoffitto",
    "stuccatura",
    "finitura",
    "tinteggiatura",
    "intonaco",
  ],
  [OntologiaEnum.pratiche_tecniche_permessi_dico]: [
    "dichiarazione di conformita",
    "dico",
    "cila",
    "scia",
    "pratiche",
    "collaudo",
    "agibilita",
    "asseverazione",
    "direzione lavori",
  ],
  [OntologiaEnum.condizionamento_ventilazione]: [
    "climatizzatore",
    "condizionatore",
    "split",
    "predisposizione clima",
    "ventilazione",
    "unità interna",
    "unità esterna",
    "aria condizionata",
    "canalizzato",
  ],
  [OntologiaEnum.impianto_fotovoltaico_pannelli]: [
    "fotovoltaico",
    "pannelli",
    "moduli",
    "kwp",
    "stringa",
    "campo fv",
    "campo fotovoltaico",
    "impianto fv",
  ],
  [OntologiaEnum.batteria_accumulo]: [
    "accumulo",
    "batteria",
    "sistema di accumulo",
    "storage",
    "kwh",
    "modulo batterie",
  ],
  [OntologiaEnum.inverter_fotovoltaico]: [
    "inverter",
    "inverter ibrido",
    "mppt",
    "convertitore",
  ],
  [OntologiaEnum.pratiche_autorizzative_fotovoltaico_gse]: [
    "gse",
    "terna",
    "pratiche connessione",
    "pratica gse",
    "gaudi",
    "e-distribuzione",
    "enel distribuzione",
    "richiesta connessione",
  ],
  [OntologiaEnum.pompe_di_calore]: [
    "pompa di calore",
    "pdc",
    "unità esterna",
    "unità interna",
    "monoblocco",
    "split pdc",
    "sistema aria acqua",
  ],
  [OntologiaEnum.altri_extra]: [
    "extra",
    "varie ed eventuali",
    "opere accessorie",
    "diverse",
    "opere complementari",
  ],
  [OntologiaEnum.unknown]: [],
};

// Heuristic tokens that mark exclusions or customer responsibilities.
export const EXCLUSION_TOKENS = [
  "escluso",
  "non incluso",
  "a carico del cliente",
] as const;

// Regex that captures euro amounts in different notations (with or without currency symbol).
export const EURO_AMOUNT_REGEX = /(?:€|eur|euro)?\s*(\d{1,3}(?:[\.\s]\d{3})*(?:[\.,]\d{2})?|\d+(?:[\.,]\d{2})?)(?:\s*(?:€|eur|euro))?/gi;

const CATEGORY_VALUES = Object.values(OntologiaEnum);

const ACCENT_REGEX = /\p{Diacritic}/gu;

function normalizeForMatching(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(ACCENT_REGEX, "")
    .replace(/[^a-z0-9\s\.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAmountToken(raw: string): number | null {
  const cleaned = raw
    .replace(/€/gi, "")
    .replace(/eur|euro/gi, "")
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:[\.,]|$))/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9\.\-]/g, "");

  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function countKeywordHits(text: string, keywords: readonly string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (!keyword) continue;
    const normalizedKeyword = normalizeForMatching(keyword);
    if (!normalizedKeyword) continue;
    if (text.includes(normalizedKeyword)) {
      hits += 1;
    }
  }
  return hits;
}

// Scores a line against keyword dictionaries and returns the best matching category.
export function findLikelyCategory(line: string): { category: OntologiaEnum; hits: number } {
  const normalizedLine = normalizeForMatching(line);
  if (!normalizedLine) {
    return { category: OntologiaEnum.unknown, hits: 0 };
  }

  let bestCategory = OntologiaEnum.unknown;
  let bestHits = 0;

  for (const category of CATEGORY_VALUES) {
    const keywords = CATEGORY_KEYWORDS[category];
    if (!keywords || keywords.length === 0) {
      continue;
    }

    const hits = countKeywordHits(normalizedLine, keywords);
    if (hits > bestHits) {
      bestCategory = category;
      bestHits = hits;
    }
  }

  return {
    category: bestHits > 0 ? bestCategory : OntologiaEnum.unknown,
    hits: bestHits,
  };
}

// Extracts the highest euro amount mentioned in the line, if any.
export function extractEuroAmount(line: string): number | null {
  const matches = Array.from(line.matchAll(EURO_AMOUNT_REGEX));
  if (matches.length === 0) {
    return null;
  }

  let maxAmount: number | null = null;
  for (const match of matches) {
    const token = match[1];
    if (!token) continue;
    const amount = normalizeAmountToken(token);
    if (amount === null) continue;
    if (maxAmount === null || amount > maxAmount) {
      maxAmount = amount;
    }
  }

  return maxAmount;
}

// Checks whether any of the provided tokens appear within the line.
export function hasAnyToken(line: string, tokens: readonly string[]): boolean {
  if (!line) {
    return false;
  }

  const normalizedLine = normalizeForMatching(line);
  return tokens.some((token) => {
    const normalizedToken = normalizeForMatching(token);
    return normalizedToken ? normalizedLine.includes(normalizedToken) : false;
  });
}

// Produces a lightweight confidence score based on hits and amount presence.
export function computeConfidence({
  keywordHits,
  hasAmount,
}: {
  keywordHits: number;
  hasAmount: boolean;
}): number {
  const keywordBonus = Math.min(0.3, keywordHits * 0.15);
  const amountBonus = hasAmount ? 0.2 : 0;
  const score = 0.5 + keywordBonus + amountBonus;

  return Math.min(1, Math.max(0, Number(score.toFixed(2))));
}

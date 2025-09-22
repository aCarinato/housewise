// Shared domain types used across parsing, normalization, and comparison stages.
import { ALL_CATEGORIES, OntologiaEnum } from "./normalize/ontology";

// Flags highlight missing or ambiguous information found during normalization.
export type ItemFlag =
  | "marca_materiale_mancante"
  | "dico_mancante"
  | "smaltimento_non_menzionato"
  | "quantita_non_chiara"
  | "esclusioni_presenti"
  | "garanzia_non_specificata"
  | "pratiche_autorizzative_non_menzionate";

export const ALL_FLAGS: readonly ItemFlag[] = [
  "marca_materiale_mancante",
  "dico_mancante",
  "smaltimento_non_menzionato",
  "quantita_non_chiara",
  "esclusioni_presenti",
  "garanzia_non_specificata",
  "pratiche_autorizzative_non_menzionate",
] as const;

// Standardized representation of a line item produced by the normalization pipeline.
export interface NormalizedItem {
  id: string;
  descrizione_originale: string;
  descrizione_normalizzata: string;
  categoria: OntologiaEnum;
  importo_euro: number | null;
  flags: ItemFlag[];
  confidence: number; // 0..1
}

// Container with metadata and aggregates for each processed quote.
export interface PreventivoProcessato {
  sorgente: string; // es. "A", "B", "C"
  items: NormalizedItem[];
  totali_per_categoria: Record<OntologiaEnum, number>;
  meta: { fileName: string; parsingNotes?: string[] };
}

// One row of the comparison summary spanning up to three quotes.
export interface ConfrontoCategoria {
  categoria: OntologiaEnum;
  inclusoA: boolean;
  inclusoB: boolean;
  inclusoC?: boolean;
  totaleA: number | null;
  totaleB: number | null;
  totaleC?: number | null;
  differenzaAB?: number | null;
  differenzaAC?: number | null;
  differenzaBC?: number | null;
}

// Final payload returned to the UI summarizing comparison insights.
export interface ConfrontoFinale {
  confronto_per_categoria: ConfrontoCategoria[];
  checklist_mancanze: string[];
  note: string[];
}

// Helper template with zeroed totals for each ontology category (clone before mutating).
export const EMPTY_TOTALI_PER_CATEGORIA: Record<OntologiaEnum, number> = Object.freeze(
  ALL_CATEGORIES.reduce((acc, categoria) => {
    acc[categoria] = 0;
    return acc;
  }, {} as Record<OntologiaEnum, number>),
) as Record<OntologiaEnum, number>;

export const CONFIDENCE_DEFAULT = 0.6;
export const CONFIDENCE_LOW = 0.4;
export const CONFIDENCE_HIGH = 0.85;

// Central enum describing the fixed ontology categories for normalization.
export enum OntologiaEnum {
  demolizioni_smaltimenti = "demolizioni_smaltimenti",
  impianto_elettrico = "impianto_elettrico",
  impianto_idrico_sanitario = "impianto_idrico_sanitario",
  impianto_termico_riscaldamento_caldaia = "impianto_termico_riscaldamento_caldaia",
  gas = "gas",
  pavimenti_rivestimenti_massetti = "pavimenti_rivestimenti_massetti",
  bagno_forniture_sanitari_rubinetteria = "bagno_forniture_sanitari_rubinetteria",
  cucina_lavori_idrici_elettrici = "cucina_lavori_idrici_elettrici",
  porte_interne = "porte_interne",
  serramenti_infissi = "serramenti_infissi",
  pittura_cartongesso_controssoffitti = "pittura_cartongesso_controssoffitti",
  pratiche_tecniche_permessi_dico = "pratiche_tecniche_permessi_dico",
  condizionamento_ventilazione = "condizionamento_ventilazione",
  impianto_fotovoltaico_pannelli = "impianto_fotovoltaico_pannelli",
  batteria_accumulo = "batteria_accumulo",
  inverter_fotovoltaico = "inverter_fotovoltaico",
  pratiche_autorizzative_fotovoltaico_gse = "pratiche_autorizzative_fotovoltaico_gse",
  pompe_di_calore = "pompe_di_calore",
  altri_extra = "altri_extra",
  unknown = "unknown",
}

// Immutable list of all ontology categories for iteration and validation.
export const ALL_CATEGORIES: readonly OntologiaEnum[] = [
  OntologiaEnum.demolizioni_smaltimenti,
  OntologiaEnum.impianto_elettrico,
  OntologiaEnum.impianto_idrico_sanitario,
  OntologiaEnum.impianto_termico_riscaldamento_caldaia,
  OntologiaEnum.gas,
  OntologiaEnum.pavimenti_rivestimenti_massetti,
  OntologiaEnum.bagno_forniture_sanitari_rubinetteria,
  OntologiaEnum.cucina_lavori_idrici_elettrici,
  OntologiaEnum.porte_interne,
  OntologiaEnum.serramenti_infissi,
  OntologiaEnum.pittura_cartongesso_controssoffitti,
  OntologiaEnum.pratiche_tecniche_permessi_dico,
  OntologiaEnum.condizionamento_ventilazione,
  OntologiaEnum.impianto_fotovoltaico_pannelli,
  OntologiaEnum.batteria_accumulo,
  OntologiaEnum.inverter_fotovoltaico,
  OntologiaEnum.pratiche_autorizzative_fotovoltaico_gse,
  OntologiaEnum.pompe_di_calore,
  OntologiaEnum.altri_extra,
  OntologiaEnum.unknown,
] as const;

// Type guard to check if a string matches one of the ontology categories.
export function isOntologiaCategory(candidate: string): candidate is OntologiaEnum {
  return (ALL_CATEGORIES as readonly string[]).includes(candidate);
}

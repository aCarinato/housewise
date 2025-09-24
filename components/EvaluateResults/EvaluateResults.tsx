'use client';

import { memo } from 'react';
import { scrollIntoViewIfNeeded } from '@/lib/dom';
import styles from './EvaluateResults.module.css';

export type EvidenceItem = { text: string; page?: number };

export type FindingKind = 'inclusion' | 'exclusion' | 'missing' | 'ambiguity' | 'risk' | 'note';

export type Importance = 'high' | 'medium' | 'low';

export type Status = 'present' | 'absent' | 'unclear';

export interface Finding {
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
}

export interface EvaluateResponse {
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
}

type EvaluateResultsProps = {
  data: EvaluateResponse | null;
};

const EvaluateResults = memo(({ data }: EvaluateResultsProps) => {
  if (!data) {
    return <p className={styles.placeholder}>Nessun output ancora disponibile.</p>;
  }

  const {
    overview,
    inclusioni_evidenti,
    esclusioni_evidenti,
    checklist_mancanze,
    punti_ambigui,
    supplier_questions,
  } = data;

  const sections = [
    {
      id: 'inclusioni',
      key: 'inclusioni',
      title: 'Inclusioni dichiarate',
      description: 'Elementi che il preventivo conferma chiaramente essere compresi nel prezzo.',
      items: inclusioni_evidenti,
      ordered: false,
    },
    {
      id: 'esclusioni',
      key: 'esclusioni',
      title: 'Esclusioni esplicite',
      description: 'Attività, materiali o oneri segnalati come esclusi o a carico del committente.',
      items: esclusioni_evidenti,
      ordered: false,
    },
    {
      id: 'mancanze',
      key: 'mancanze',
      title: 'Mancanze da chiarire',
      description: 'Aspetti attesi ma non trovati nel preventivo (tempi, garanzie, pratiche, ecc.).',
      items: checklist_mancanze,
      ordered: false,
    },
    {
      id: 'ambigui',
      key: 'ambigui',
      title: 'Punti ambigui',
      description: 'Voci poco chiare o descritte in modo generico che meritano un approfondimento.',
      items: punti_ambigui,
      ordered: false,
    },
  ].filter((section) => section.items.length > 0);

  const summaryCounts = [
    { label: 'Inclusioni', count: inclusioni_evidenti.length, target: 'section-inclusioni' },
    { label: 'Esclusioni', count: esclusioni_evidenti.length, target: 'section-esclusioni' },
    { label: 'Mancanze', count: checklist_mancanze.length, target: 'section-mancanze' },
    { label: 'Ambiguità', count: punti_ambigui.length, target: 'section-ambigui' },
    { label: 'Domande al fornitore', count: supplier_questions.length, target: 'supplier-questions' },
  ].filter(({ count }) => count > 0);

  const handleSummaryClick = (targetId: string) => {
    const element = document.getElementById(targetId);
    if (element) {
      scrollIntoViewIfNeeded(element as HTMLElement, 120);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.summaryBox}>
        <h3>Riepilogo</h3>
        {summaryCounts.length > 0 ? (
          <div className={styles.summaryCounts}>
            {summaryCounts.map(({ label, count, target }) => (
              <button
                key={target}
                type="button"
                className={styles.summaryPill}
                onClick={() => handleSummaryClick(target)}
              >
                <strong>{count}</strong>
                <span>{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.sectionNote}>Nessuna evidenza specifica rilevata nelle categorie principali.</p>
        )}
      </section>

      <section className={styles.overviewBox}>
        <h3>Nota generale</h3>
        <p>{overview}</p>
      </section>

      <section className={styles.questionsBox} id="supplier-questions">
        <h3>Cosa chiedere al fornitore</h3>
        <p className={styles.sectionNote}>Domande suggerite per evitare sorprese e ottenere un preventivo realmente completo.</p>
        <ol>
          {supplier_questions.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ol>
      </section>

      {sections.length > 0 ? (
        <section className={styles.sectionsGrid}>
          {sections.map((section) => (
            <div key={section.key} id={`section-${section.id}`} className={styles.sectionCard}>
              <header>
                <h4>{section.title}</h4>
                <p className={styles.sectionNote}>{section.description}</p>
              </header>
              {section.ordered ? (
                <ol>
                  {section.items.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ol>
              ) : (
                <ul>
                  {section.items.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
});

EvaluateResults.displayName = 'EvaluateResults';

export default EvaluateResults;

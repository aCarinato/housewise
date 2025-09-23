'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { bytesToReadable } from '@/lib/utils/file';
import styles from './page.module.css';

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.csv', '.xlsx'];
const ACCEPTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function fileAllowed(file: File | null): boolean {
  if (!file) return false;
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

const ComparePage = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState('A');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<unknown>(null);

  const fileHint = useMemo(() => {
    if (!selectedFile) {
      return 'Nessun file selezionato';
    }
    const size = bytesToReadable(selectedFile.size);
    return `${selectedFile.name}${size ? ` (${size})` : ''}`;
  }, [selectedFile]);

  const formattedResult = useMemo(() => {
    if (!aiResult) {
      return '';
    }

    try {
      return JSON.stringify(aiResult, null, 2);
    } catch (err) {
      console.error('Errore serializzazione risultato AI', err);
      return String(aiResult);
    }
  }, [aiResult]);

  const itemsCount = useMemo(() => {
    if (!aiResult || typeof aiResult !== 'object') {
      return 0;
    }
    const items = (aiResult as { items?: unknown[] }).items;
    return Array.isArray(items) ? items.length : 0;
  }, [aiResult]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setAiResult(null);

    if (!file) {
      setSelectedFile(null);
      setError(null);
      return;
    }

    if (!fileAllowed(file)) {
      setSelectedFile(null);
      setError('Formato non supportato. Carica PDF, TXT, CSV o XLSX.');
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (isLoading) return;

    if (!selectedFile) {
      setError('Seleziona prima un file da analizzare.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setAiResult(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('source_label', sourceLabel || 'A');

      const response = await fetch('/api/ai/normalize', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : { error: await response.text() };

      if (!response.ok) {
        throw new Error(payload?.error || 'Errore durante l\'analisi AI');
      }

      setAiResult(payload);
      console.log('AI normalized output:', payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore imprevisto durante l\'analisi AI';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Analisi Preventivo</h1>
        <p>Carica un preventivo (PDF, TXT, CSV o XLSX) e lascia che Gemini estragga e normalizzi le voci.</p>
      </div>

      <Card title="Caricamento preventivo">
        <div className={styles.uploadArea}>
          <label className={styles.fileLabel} htmlFor="quoteFile">
            Seleziona file
          </label>
          <input
            id="quoteFile"
            className={styles.fileInput}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileChange}
          />
          <p className={styles.fileHint}>{fileHint}</p>
          <p className={styles.accepted}>Formati supportati: PDF, TXT, CSV, XLSX (max 20MB)</p>

          <label className={styles.sourceLabel} htmlFor="sourceLabel">
            Etichetta sorgente (A/B/C...)
          </label>
         <input
            id="sourceLabel"
            className={styles.sourceInput}
            type="text"
            maxLength={1}
            value={sourceLabel}
            onChange={(event) => {
              const value = (event.target.value || '').toUpperCase().slice(0, 1);
              setSourceLabel(value || 'A');
            }}
          />

          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </Card>

      <div className={styles.actions}>
        <Button onClick={handleAnalyze}>{isLoading ? 'Richiesta a Gemini…' : 'Analizza preventivo'}</Button>
      </div>

      <Card title="Risultato AI (JSON)">
        {formattedResult ? (
          <div className={styles.outputBox}>
            <p className={styles.outputIntro}>
              {itemsCount > 0
                ? `Elementi normalizzati restituiti: ${itemsCount}`
                : 'Risposta ricevuta dal modello Gemini.'}
            </p>
            <pre className={styles.resultPre}>{formattedResult}</pre>
          </div>
        ) : (
          <p className={styles.placeholder}>Nessun output ancora disponibile.</p>
        )}
      </Card>
    </main>
  );
};

export default ComparePage;

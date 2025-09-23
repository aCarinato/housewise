'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { bytesToReadable } from '@/lib/utils/file';
import styles from './page.module.css';
import EvaluateResults, {
  EvaluateResponse,
} from '@/components/EvaluateResults/EvaluateResults';

const ACCEPTED_EXTENSIONS = ['.pdf'];
const ACCEPTED_TYPES = ['application/pdf'];

function fileAllowed(file: File | null): boolean {
  if (!file) return false;
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

const ComparePage = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<EvaluateResponse | null>(null);

  const fileHint = useMemo(() => {
    if (!selectedFile) {
      return 'Nessun file selezionato';
    }
    const size = bytesToReadable(selectedFile.size);
    return `${selectedFile.name}${size ? ` (${size})` : ''}`;
  }, [selectedFile]);

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
      const response = await fetch('/api/ai/evaluate', {
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

      setAiResult(payload as EvaluateResponse);
      console.log('AI evaluation output:', payload);
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
        <p>Carica un preventivo in PDF e lascia che Gemini evidenzi inclusioni, esclusioni e rischi principali.</p>
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
          <p className={styles.accepted}>Formato supportato: solo PDF (max 20MB)</p>

          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </Card>

      <div className={styles.actions}>
        <Button onClick={handleAnalyze}>{isLoading ? 'Richiesta a Gemini…' : 'Analizza preventivo'}</Button>
      </div>

      <Card title="Risultato AI">
        <EvaluateResults data={aiResult} />
      </Card>
    </main>
  );
};

export default ComparePage;

'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { bytesToReadable } from '@/lib/utils/file';
import styles from './page.module.css';
import EvaluateResults, {
  EvaluateResponse,
} from '@/components/EvaluateResults/EvaluateResults';
import CategorySelector, {
  type CategoryInfo,
} from '@/components/CategorySelector/CategorySelector';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { trackEvent } from '@/lib/analytics';
import { scrollIntoViewIfNeeded } from '@/lib/dom';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const ACCEPTED_EXTENSIONS = ['.pdf'];
const ACCEPTED_TYPES = ['application/pdf'];

function fileAllowed(file: File | null): boolean {
  if (!file) return false;
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

const CATEGORIES: CategoryInfo[] = [
  {
    id: 'bagno',
    label: 'Bagno',
    description: 'Rifacimento completo, sanitari, doccia, rivestimenti.',
  },
  {
    id: 'cucina',
    label: 'Cucina',
    description: 'Impianti idrici/elettrici, collegamenti gas, rivestimenti.',
  },
  {
    id: 'interni',
    label: 'Ristrutturazione interni',
    description: 'Demolizioni, pavimenti, cartongesso, tinteggiature, infissi.',
  },
  {
    id: 'elettrico',
    label: 'Impianto elettrico',
    description: 'Punti luce, quadri, certificazioni.',
  },
  {
    id: 'idraulico',
    label: 'Impianto idraulico / termico',
    description: 'Caldaie, pompe di calore, termosifoni.',
  },
  {
    id: 'infissi',
    label: 'Infissi e serramenti',
    description: 'Finestre, porte-finestre, vetri, tapparelle.',
  },
  {
    id: 'tinteggiatura',
    label: 'Tinteggiatura e cartongesso',
    description: 'Imbiancature, controsoffitti, isolamenti interni.',
  },
  {
    id: 'fotovoltaico',
    label: 'Impianto fotovoltaico',
    description: 'Pannelli solari, inverter, batterie, pratiche GSE.',
  },
  {
    id: 'clima',
    label: 'Climatizzazione',
    description: 'Condizionatori, ventilazione, canalizzazioni.',
  },
  {
    id: 'altri',
    label: 'Altri lavori edilizi',
    description: 'Opere murarie, esterni, giardino, extra vari.',
  },
];

const ComparePage = () => {
  const [selectedCategory, setSelectedCategory] = useState<
    CategoryInfo['id'] | null
  >(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<EvaluateResponse | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const uploadRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const handleCategorySelect = (categoryId: CategoryInfo['id']) => {
    const nextCategory = categoryId === selectedCategory ? null : categoryId;
    setSelectedCategory(nextCategory);
    setSelectedFile(null);
    setHasSubmitted(false);
    setAiResult(null);
    setError(null);
  };

  const fileHint = useMemo(() => {
    if (!selectedFile) {
      return 'Nessun file selezionato';
    }
    const size = bytesToReadable(selectedFile.size);
    return `${selectedFile.name}${size ? ` (${size})` : ''}`;
  }, [selectedFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setHasSubmitted(false);
    setAiResult(null);

    if (!file) {
      setSelectedFile(null);
      setError(null);
      return;
    }

    if (!fileAllowed(file)) {
      setSelectedFile(null);
      setError('Formato non supportato. Carica un PDF.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    trackEvent('file_upload', {
      category: selectedCategory ?? 'non_selezionato',
      fileName: file.name,
      fileSize: file.size,
    });
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq('trackCustom', 'PreventivoUpload', {
        category: selectedCategory ?? 'non_selezionato',
      });
    }
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
      setHasSubmitted(false);

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
        throw new Error(payload?.error || "Errore durante l'analisi AI");
      }

      setHasSubmitted(true);
      setAiResult(payload as EvaluateResponse);
      trackEvent('analizza_preventivo', {
        category: selectedCategory ?? 'non_selezionato',
        fileName: selectedFile.name,
      });
      console.log('AI evaluation output:', payload);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Errore imprevisto durante l'analisi AI";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCategory && uploadRef.current) {
      scrollIntoViewIfNeeded(uploadRef.current);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedFile && actionsRef.current) {
      scrollIntoViewIfNeeded(actionsRef.current);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (hasSubmitted && !isLoading && resultsRef.current) {
      scrollIntoViewIfNeeded(resultsRef.current);
    }
  }, [hasSubmitted, isLoading]);

  return (
    <main className={styles.page}>
      {isLoading ? <LoadingOverlay /> : null}
      <div className={styles.header}>
        <h1>Analisi Preventivo</h1>
        <p>
          Carica il tuo preventivo, noi ti diciamo subito cosa manca e dove
          rischi di più.
        </p>
      </div>

      <Card subdued title="Seleziona il tipo di preventivo">
        <CategorySelector
          categories={CATEGORIES}
          selectedId={selectedCategory}
          onSelect={handleCategorySelect}
        />
      </Card>

      {selectedCategory ? (
        <Card title="Caricamento preventivo">
          <div ref={uploadRef} className={styles.uploadArea}>
            {/* <p className={styles.fileLabel}>Seleziona il preventivo in formato PDF</p> */}
            <label className={styles.fileButton} htmlFor="quoteFile">
              Carica file PDF
            </label>
            <input
              id="quoteFile"
              className={styles.fileInput}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              onChange={handleFileChange}
            />
            <p className={styles.fileHint}>{fileHint}</p>
            <p className={styles.accepted}>
              Formato supportato: solo PDF (max 20MB)
            </p>

            {error ? <p className={styles.error}>{error}</p> : null}
          </div>
        </Card>
      ) : null}

      {selectedFile ? (
        <div ref={actionsRef} className={styles.actions}>
          <Button onClick={handleAnalyze} disabled={isLoading}>
            {isLoading ? 'Richiesta a Gemini…' : 'Analizza preventivo'}
          </Button>
        </div>
      ) : null}

      {hasSubmitted ? (
        <Card title="">
          <div ref={resultsRef}>
            <EvaluateResults data={aiResult} />
          </div>
        </Card>
      ) : null}
    </main>
  );
};

export default ComparePage;

'use client';

import Spinner from './Spinner';
import styles from './LoadingOverlay.module.css';

type LoadingOverlayProps = {
  message?: string;
  hint?: string;
};

const LoadingOverlay = ({
  message = 'Analisi in corso…',
  hint = 'Stiamo elaborando il preventivo, questa operazione richiede alcuni secondi.',
}: LoadingOverlayProps) => (
  <div className={styles.overlay} role="status" aria-live="polite">
    <div className={styles.panel}>
      <Spinner label={message} />
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  </div>
);

export default LoadingOverlay;

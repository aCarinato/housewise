'use client';

import styles from './Spinner.module.css';

type SpinnerProps = {
  label?: string;
};

const Spinner = ({ label = 'Analisi in corso…' }: SpinnerProps) => (
  <div className={styles.wrapper}>
    <div className={styles.loader} />
    {label ? <p className={styles.label}>{label}</p> : null}
  </div>
);

export default Spinner;
